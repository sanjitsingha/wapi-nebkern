"use client";

/**
 * Canvas / mind-map view of a flow. Editable, in parity with the
 * list view for everything except the trigger / header / fallback
 * panels (those are list-only — they don't fit visually inside a
 * node graph and the user can switch to List for them).
 *
 * What this view does:
 *   - Renders every flow_node as a draggable tile, pan + zoom +
 *     minimap. Drag positions persist via the editor context
 *     (writing on dragStop, not every frame).
 *   - Renders edges between nodes, labeled per slot (button title,
 *     "true" / "false", list row title) so a branching flow reads
 *     as a real decision tree.
 *   - Click a node → side-sheet opens with the same per-node form
 *     the list view uses, plus "Set as entry" / "Delete".
 *   - Drag from a source handle on one node to a target handle on
 *     another → wires that slot's `next_node_key`. Per-slot handles
 *     for multi-outgoing types (condition, send_buttons, send_list)
 *     so the user picks which branch they're wiring.
 *   - Backspace / Delete on a selected node → removes it AND clears
 *     every inbound `next_node_key` reference (no dangling arrows).
 *   - Delete on a selected edge → clears just that slot.
 *   - "+ Add node" floating button drops a new node at the visible
 *     viewport center.
 *   - Runs dagre auto-layout once on mount for flows whose
 *     `position_x` / `position_y` are all zero (pre-canvas flows
 *     and brand-new flows) — otherwise everything would pile at
 *     the origin.
 *
 * The toggle in `flow-editor-shell.tsx` swaps this in for
 * `<FlowBuilder>` on the same page. Both views share the same
 * `BuilderState` via `useFlowEditor()` — toggling never resets
 * unsaved edits, and a drag here updates the same nodes array the
 * list view reads.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Node as RfNode,
  type Edge as RfEdge,
  type NodeChange,
  type NodeProps,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Trash2, Search, CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  applyEdgeConnection,
  deriveCanvasEdges,
  outgoingSlots,
} from "@/lib/flows/edges";
import { autoLayout, shouldAutoLayout } from "@/lib/flows/layout";
import {
  NODE_META,
  summarizeNode,
  type BuilderNode,
  type NodeType,
} from "./shared";
import { useFlowEditor } from "./flow-editor-state";
import { NodeConfigForm } from "./forms/node-config-form";
import { IssueLine } from "./validation-panel";
import { InfoHint } from "@/components/ui/info-hint";

// React-Flow node `data` payload — the bits our custom renderer needs.
interface NodeData extends Record<string, unknown> {
  node: BuilderNode;
  isEntry: boolean;
  /** Validator's "look here" pulse — flashes the card border for
   *  ~1.6s. Drives a CSS animation, doesn't change layout. */
  isFlashed: boolean;
}

const NODE_WIDTH = 240;
// Best-effort default; actual height varies by summary length but
// dagre needs SOMETHING to compute rank spacing. Underestimating is
// safer than over (tighter layout that still doesn't overlap).
const NODE_HEIGHT = 90;

// Per-node border color, matching each node's icon accent (NODE_META
// `color`). Static class strings so Tailwind's JIT emits them — a
// runtime `text-` → `border-` swap would produce classes it never sees.
// Short "what does this node do" help, shown as an ⓘ tooltip in the
// settings-panel header (with a Learn more link). Add entries as more
// node types get explainers.
const NODE_HELP: Partial<
  Record<NodeType, { label: string; docs: string; text: string }>
> = {
  collect_input: {
    label: "Collect input",
    docs: "/docs/flows",
    text: "Asks the customer a question, then waits for their reply and saves the answer to a variable you can reuse later in the flow (for example, to fill a template or update the contact). Set the prompt, the variable name, and an optional validation type (text, email, number…).",
  },
};

const NODE_BORDER: Record<NodeType, string> = {
  start: "border-emerald-400",
  send_message: "border-sky-400",
  send_buttons: "border-primary",
  send_list: "border-indigo-400",
  send_media: "border-cyan-400",
  collect_input: "border-teal-400",
  condition: "border-fuchsia-400",
  set_tag: "border-pink-400",
  handoff: "border-amber-400",
  end: "border-muted-foreground",
};

// ============================================================
// Custom node — one card per flow node, styled to match the list
// view's collapsed card so the two views feel like the same product.
// ============================================================

function FlowNodeCard({ data, selected }: NodeProps) {
  const { node, isEntry, isFlashed } = data as NodeData;
  const meta = NODE_META[node.node_type];
  const summary = summarizeNode(node);
  const Icon = meta.icon;
  const slots = outgoingSlots(node);
  // Start nodes are entry-only; nothing ever targets them, so they
  // don't need an incoming Handle. Every other node type accepts
  // incoming edges (including terminal handoff / end — they're the
  // common targets).
  const hasTarget = node.node_type !== "start";
  // Single-slot nodes get a single source handle floated on the right
  // edge of the card. Multi-slot nodes (condition, send_buttons,
  // send_list) render slot rows inline so each handle visually sits
  // next to the slot it represents.
  const isMultiSlot = slots.length > 1;
  return (
    <div
      className={cn(
        "relative min-w-[220px] max-w-[260px] rounded-lg bg-card/95 px-3 py-2 text-left shadow-lg backdrop-blur transition-all",
        // Keep the node's own accent colour whether idle or grabbed —
        // selection just thickens the border rather than recolouring it.
        NODE_BORDER[node.node_type],
        selected ? "border-2" : "border",
        // Flash overrides the colour briefly. Tailwind's built-in
        // `animate-pulse` is too gentle; a ring with the amber accent
        // matches the list view's flash semantics.
        isFlashed && "!border-amber-400 ring-2 ring-amber-400/60",
      )}
    >
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-border !bg-muted"
        />
      )}

      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {meta.label}
        </span>
        {isEntry && (
          <span className="ml-auto rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
            Entry
          </span>
        )}
      </div>
      <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
        {node.node_key}
      </div>
      {summary && (
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {summary}
        </div>
      )}

      {isMultiSlot && (
        <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="relative flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[11px] text-muted-foreground"
            >
              <span className="truncate" title={slot.label}>
                {slot.label}
              </span>
              <Handle
                type="source"
                id={slot.id}
                position={Position.Right}
                // Override default absolute positioning so the handle
                // sits flush with the right edge of the card instead
                // of floating at vertical center. The negative offset
                // matches the card's px-3 + the handle's own radius.
                className="!relative !right-auto !top-auto !h-2.5 !w-2.5 !translate-x-[12px] !transform-none !border-border !bg-muted"
              />
            </div>
          ))}
        </div>
      )}

      {!isMultiSlot && slots.length === 1 && (
        <Handle
          type="source"
          id={slots[0].id}
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-border !bg-muted"
        />
      )}
    </div>
  );
}

const NODE_TYPES = { flow: FlowNodeCard };

// ============================================================
// Root canvas
// ============================================================

/**
 * Outer wrapper provides the React-Flow context to the inner body,
 * so `useReactFlow()` works from anywhere in `FlowCanvasInner`
 * (notably, the pan-to-flash effect). The split is required because
 * useReactFlow() must be called inside a ReactFlowProvider.
 */
export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}

function FlowCanvasInner() {
  const {
    state,
    setState,
    updateNodeConfig,
    updateNodePosition,
    updateNodePositions,
    removeNode,
    flashKey,
  } = useFlowEditor();
  const reactFlow = useReactFlow();
  const builderNodes = state.nodes;
  const entryNodeId = state.entry_node_id;

  // Side-panel state — which node's form is open. Canvas-only UI; the
  // list view's analogue is the per-card expanded set in
  // flow-builder.tsx.
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const selectedNode = useMemo(
    () =>
      selectedNodeKey
        ? builderNodes.find((n) => n.node_key === selectedNodeKey) ?? null
        : null,
    [selectedNodeKey, builderNodes],
  );

  const autoLayoutPositions = useMemo(() => {
    const canvasEdges = deriveCanvasEdges(builderNodes);

    return shouldAutoLayout(builderNodes)
      ? autoLayout(
          builderNodes.map((n) => ({
            id: n.node_key,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          })),
          canvasEdges.map((e) => ({ source: e.source, target: e.target })),
          { direction: "TB" },
        )
      : null;
  }, [builderNodes]);

  // If dagre had to place an all-zero flow, persist the generated
  // positions into editor state once. Otherwise the next drag would
  // save only the dragged node and every other node would fall back
  // to (0,0), which feels like nodes teleporting around the canvas.
  const persistedAutoLayoutRef = useRef(false);
  useEffect(() => {
    if (!autoLayoutPositions || persistedAutoLayoutRef.current) return;
    persistedAutoLayoutRef.current = true;
    updateNodePositions(
      Object.fromEntries(
        [...autoLayoutPositions].map(([key, pos]) => [key, pos]),
      ),
    );
  }, [autoLayoutPositions, updateNodePositions]);

  const derivedRfNodes = useMemo(() => {
    const nodes: RfNode<NodeData>[] = builderNodes.map((n) => {
      const fallback = autoLayoutPositions?.get(n.node_key);
      return {
        id: n.node_key,
        type: "flow",
        position: {
          x: fallback?.x ?? n.position_x ?? 0,
          y: fallback?.y ?? n.position_y ?? 0,
        },
        data: {
          node: n,
          isEntry: n.node_key === entryNodeId,
          isFlashed: n.node_key === flashKey,
        },
      };
    });

    return nodes;
  }, [builderNodes, entryNodeId, flashKey, autoLayoutPositions]);

  const [rfNodes, setRfNodes] = useState<RfNode<NodeData>[]>(derivedRfNodes);

  useEffect(() => {
    setRfNodes(derivedRfNodes);
  }, [derivedRfNodes]);

  const rfEdges = useMemo(() => {
    const canvasEdges = deriveCanvasEdges(builderNodes);

    // sourceHandle is now wired up — the FlowNodeCard renders a Handle
    // per slot whose id matches the scheme in edges.ts, so React-Flow
    // can hang the arrow off the right place on each card.
    const rfEdges: RfEdge[] = canvasEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      label: e.label,
      // Mode-aware via CSS tokens so edge chrome flips with light/dark.
      labelStyle: { fill: "var(--muted-foreground)", fontSize: 11 },
      labelBgStyle: { fill: "var(--card)" },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: "var(--border)", strokeWidth: 1.5 },
    }));

    return rfEdges;
  }, [builderNodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<RfNode<NodeData>>[]) => {
      setRfNodes((nodes) => applyNodeChanges(changes, nodes));
    },
    [],
  );

  // Drag-to-position: React-Flow tracks the visual drag internally and
  // fires this once on release. We write the final coordinate back to
  // the editor context (which flips `dirty`); save then ships the new
  // positions in the existing PUT /api/flows/[id] body (the route
  // already destructures position_x / position_y per migration 010).
  // Writing only on dragStop (not on every position-change tick during
  // the drag) keeps state updates cheap on long drags.
  const handleNodeDragStop = useCallback<OnNodeDrag<RfNode<NodeData>>>(
    (_event, node) => {
      updateNodePosition(node.id, node.position.x, node.position.y);
    },
    [updateNodePosition],
  );

  // Pan to the flashed node when the validator panel requests one.
  // Animate over 400ms; landing zoom is whatever the user already has
  // (don't force a zoom reset — that would be jarring mid-edit).
  useEffect(() => {
    if (!flashKey) return;
    const node = builderNodes.find((n) => n.node_key === flashKey);
    if (!node) return;
    const x = (node.position_x ?? 0) + NODE_WIDTH / 2;
    const y = (node.position_y ?? 0) + NODE_HEIGHT / 2;
    reactFlow.setCenter(x, y, {
      zoom: reactFlow.getZoom(),
      duration: 400,
    });
  }, [flashKey, builderNodes, reactFlow]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: RfNode<NodeData>) => {
      setSelectedNodeKey(node.id);
    },
    [],
  );

  // Drag-to-connect: React-Flow fires onConnect when the user drops a
  // handle drag onto a target handle. We look up the source node,
  // compute the right config patch via applyEdgeConnection (matches
  // the same slot scheme as deriveCanvasEdges), and dispatch via
  // updateNodeConfig. The resulting state change re-derives edges on
  // the next render — no need to maintain a separate edge list.
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle) {
        return;
      }
      const sourceNode = builderNodes.find(
        (n) => n.node_key === connection.source,
      );
      if (!sourceNode) return;
      // Self-loops are a footgun (a button whose target is its own
      // node = infinite reprompt). Reject silently — the user can
      // still wire one via the per-node dropdown if they really want.
      if (connection.source === connection.target) return;
      const patch = applyEdgeConnection(
        sourceNode,
        connection.sourceHandle,
        connection.target,
      );
      if (patch) updateNodeConfig(connection.source, patch);
    },
    [builderNodes, updateNodeConfig],
  );

  // Keyboard delete (Backspace / Delete) + drag-to-trash. React-Flow
  // fires this with the set of deleted-node objects; we route each
  // through the editor context's removeNode (which now also unlinks
  // inbound references so no dangling arrows survive). Closing the
  // side panel on delete keeps the UI honest if the user deleted the
  // node currently being edited.
  const handleNodesDelete = useCallback(
    (deleted: RfNode<NodeData>[]) => {
      for (const n of deleted) {
        removeNode(n.id);
        if (selectedNodeKey === n.id) setSelectedNodeKey(null);
      }
    },
    [removeNode, selectedNodeKey],
  );

  // Edge delete: clear the source node's slot rather than removing
  // anything. Edges are derived from configs, so the only way to
  // "delete" one is to null out its underlying next_node_key.
  const handleEdgesDelete = useCallback(
    (deleted: RfEdge[]) => {
      for (const e of deleted) {
        if (!e.sourceHandle) continue;
        const sourceNode = builderNodes.find((n) => n.node_key === e.source);
        if (!sourceNode) continue;
        const patch = applyEdgeConnection(sourceNode, e.sourceHandle, "");
        if (patch) updateNodeConfig(e.source, patch);
      }
    },
    [builderNodes, updateNodeConfig],
  );

  // Wrapped mutators that target the currently-selected node — pass to
  // the form so each keystroke goes through the editor context (which
  // flips `dirty` and feeds the validator).
  const onSelectedUpdateConfig = useCallback(
    (patch: Record<string, unknown>) => {
      if (selectedNodeKey) updateNodeConfig(selectedNodeKey, patch);
    },
    [selectedNodeKey, updateNodeConfig],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeKey) return;
    removeNode(selectedNodeKey);
    setSelectedNodeKey(null);
  }, [selectedNodeKey, removeNode]);

  const handleSetEntry = useCallback(() => {
    if (!selectedNodeKey) return;
    setState((s) => ({ ...s, entry_node_id: selectedNodeKey }));
  }, [selectedNodeKey, setState]);

  return (
    <div className="flex h-full w-full">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
        {rfNodes.length === 0 ? (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-background text-sm text-muted-foreground"
            style={{
              backgroundImage:
                'radial-gradient(color-mix(in oklch, var(--border) 90%, transparent) 1.4px, transparent 1.4px)',
              backgroundSize: '22px 22px',
            }}
          >
            <p>No nodes yet.</p>
            <p className="text-xs">Add a node from the panel on the right.</p>
          </div>
        ) : (
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onConnect={handleConnect}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          // Default is "Backspace" only — accept both so Mac users
          // hitting Delete (Fn+Backspace) get the same behavior.
          deleteKeyCode={["Backspace", "Delete"]}
          nodesConnectable={true}
          edgesFocusable={true}
          elementsSelectable={true}
          // Lower default min/max zoom than the lib's defaults; the
          // tiles already truncate their summary at a reasonable
          // size, so we don't need to zoom past 1.5x.
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.4}
            color="color-mix(in oklch, var(--border) 90%, transparent)"
          />
          <Controls
            position="bottom-left"
            className="!border-border !bg-card [&_button]:!border-border [&_button]:!bg-card [&_button:hover]:!bg-muted [&_button_svg]:!fill-foreground"
            showInteractive={false}
          />
          {/* MiniMap sits at the bottom-left, just to the right of the
              zoom controls (offset past their ~40px column). */}
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeColor="var(--muted-foreground)"
            maskColor="color-mix(in oklch, var(--background) 70%, transparent)"
            className="!border !border-border !bg-card"
            style={{ left: 56, bottom: 12, width: 150, height: 96 }}
          />
        </ReactFlow>
        )}

        {/* Validation status — floating at the canvas bottom-right. */}
        <CanvasValidationBadge />
      </div>

      {/* Fixed node palette docked on the right — always visible, with a
          search box. Clicking a node drops it on the canvas and opens its
          settings (the sheet slides over this panel). */}
      <aside className="hidden w-96 shrink-0 flex-col border-l border-border bg-card md:flex">
        <NodePalette onAdded={(key) => setSelectedNodeKey(key)} />
      </aside>

      <NodeEditSheet
        node={selectedNode}
        isEntry={selectedNode?.node_key === entryNodeId}
        allNodes={builderNodes}
        onClose={() => setSelectedNodeKey(null)}
        onUpdateConfig={onSelectedUpdateConfig}
        onDelete={handleDeleteSelected}
        onSetEntry={handleSetEntry}
      />
    </div>
  );
}

// ============================================================
// Side panel — opens when a canvas node is clicked. Mounts the
// shared NodeConfigForm dispatcher so edits made here behave
// identically to the list view's per-card editor.
// ============================================================

function NodeEditSheet({
  node,
  isEntry,
  allNodes,
  onClose,
  onUpdateConfig,
  onDelete,
  onSetEntry,
}: {
  node: BuilderNode | null;
  isEntry: boolean;
  allNodes: BuilderNode[];
  onClose: () => void;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onSetEntry: () => void;
}) {
  // Sheet is controlled — opens when a node is selected, closes via
  // Esc / overlay / close button (all delegated to onClose).
  const open = node !== null;
  if (!node) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }
  const meta = NODE_META[node.node_type];
  const Icon = meta.icon;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-border bg-popover p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-popover-foreground">
            <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
            <span>{meta.label}</span>
            {NODE_HELP[node.node_type] && (
              <InfoHint
                label={NODE_HELP[node.node_type]!.label}
                docs={NODE_HELP[node.node_type]!.docs}
              >
                {NODE_HELP[node.node_type]!.text}
              </InfoHint>
            )}
            {isEntry && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Entry
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="font-mono text-[11px] text-muted-foreground">
            {node.node_key}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <NodeConfigForm
            node={node}
            allNodes={allNodes}
            showAdvanced={false}
            onUpdateConfig={onUpdateConfig}
          />
        </div>

        <SheetFooter className="border-t border-border px-5 py-3 sm:flex-row sm:justify-between">
          {!isEntry ? (
            <Button variant="ghost" size="sm" onClick={onSetEntry}>
              Set as entry
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete node
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Node palette — a fixed panel docked on the right of the canvas.
// Always visible, with a search box; clicking a node drops it at the
// center of the visible viewport (mirrors the list view's NodeType
// list + icons via NODE_META).
// ============================================================

const ADD_NODE_TYPES: NodeType[] = [
  "start",
  "send_buttons",
  "send_list",
  "send_message",
  "send_media",
  "collect_input",
  "condition",
  "set_tag",
  "handoff",
  "end",
];

function NodePalette({ onAdded }: { onAdded: (key: string) => void }) {
  const reactFlow = useReactFlow();
  const { addNode, updateNodePosition } = useFlowEditor();
  const [query, setQuery] = useState("");

  const handleAdd = (type: NodeType): string => {
    const key = addNode(type);
    // Place the new node at the visible canvas center. If we can't find
    // the .react-flow root (test envs, etc.), addNode's default (0, 0)
    // is the fallback and the user can drag the node into view.
    const root = document.querySelector(".react-flow") as HTMLElement | null;
    if (root) {
      const rect = root.getBoundingClientRect();
      const center = reactFlow.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      // NODE_WIDTH / NODE_HEIGHT are the dagre layout defaults; offset
      // so the card sits visually centered rather than top-left at the
      // viewport center.
      updateNodePosition(key, center.x - NODE_WIDTH / 2, center.y - NODE_HEIGHT / 2);
    }
    return key;
  };

  const q = query.trim().toLowerCase();
  const filtered = ADD_NODE_TYPES.filter((t) =>
    NODE_META[t].label.toLowerCase().includes(q),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Nodes</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Click a node to add it to the canvas.
        </p>
      </div>

      <div className="shrink-0 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes"
            className="w-full rounded-md border border-border bg-muted py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No nodes match &quot;{query.trim()}&quot;.
          </p>
        ) : (
          <div className="grid gap-1.5">
            {filtered.map((t) => {
              const meta = NODE_META[t];
              const Icon = meta.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const key = handleAdd(t);
                    setQuery("");
                    onAdded(key);
                  }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className={cn("h-4 w-4", meta.color)} />
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Validation badge — floats at the canvas bottom-right. Shows the
// flow's health at a glance (red = errors, amber = warnings, green =
// clean) and, on click, opens the same clickable issue list the
// header modal uses so a jump flashes the offending node.
// ============================================================

function CanvasValidationBadge() {
  const { issues, requestFlash } = useFlowEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the popover when clicking anywhere outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const tone =
    errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "ok";

  return (
    <div ref={ref} className="absolute bottom-4 right-4 z-10">
      {open && issues.length > 0 && (
        <div className="absolute bottom-full right-0 mb-2 max-h-80 w-80 overflow-y-auto rounded-lg border border-border bg-background p-2 shadow-xl">
          <div className="flex flex-col gap-1">
            {issues.map((i, ix) => (
              <IssueLine
                key={ix}
                issue={i}
                onJump={(k) => {
                  requestFlash(k);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bare icon — no bg / outline, matching the old top-bar indicator.
          Count sits in a coloured circle at the corner. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Validation issues"
        title={
          tone === "ok"
            ? "No issues"
            : `${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"}`
        }
        className={cn(
          "relative flex size-8 items-center justify-center transition-colors",
          tone === "error"
            ? "text-red-500"
            : tone === "warning"
              ? "text-amber-500"
              : "text-emerald-500",
        )}
      >
        {tone === "ok" ? (
          <CircleCheck className="h-5 w-5 drop-shadow-sm" />
        ) : (
          <CircleAlert className="h-5 w-5 drop-shadow-sm" />
        )}
        {issues.length > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white",
              tone === "error" ? "bg-red-500" : "bg-amber-500",
            )}
          >
            {issues.length > 99 ? "99+" : issues.length}
          </span>
        )}
      </button>
    </div>
  );
}
