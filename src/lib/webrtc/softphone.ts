// ============================================================
// The WebRTC half of WhatsApp calling.
//
// Media is peer-to-peer: this browser on one end, the customer's handset
// on the other. Our server only relays the SDP that lets them find each
// other, and never carries audio.
//
// One rule shapes most of this file: **no trickle ICE**. Meta's Calling
// API takes a single complete SDP, so every candidate has to be gathered
// BEFORE the offer or answer is sent. That is why `localDescription` is
// awaited through `waitForIceGathering` rather than read immediately —
// reading it too early yields a valid-looking SDP with no candidates in
// it, and the call connects to silence.
// ============================================================

/**
 * STUN lets each peer discover its public address. Google's public
 * server is the default because it needs no account and no secret.
 *
 * A STUN-only setup fails for the minority of networks behind symmetric
 * NAT — corporate wifi, some mobile carriers — where a TURN relay is the
 * only path. TURN needs credentials, so it is opt-in via
 * NEXT_PUBLIC_TURN_URL / _USERNAME / _CREDENTIAL rather than assumed.
 */
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

export type SoftphoneState =
  | 'idle'
  | 'requesting-mic'
  | 'negotiating'
  | 'connecting'
  | 'in-call'
  | 'ended'
  | 'failed';

export interface SoftphoneEvents {
  onState?: (state: SoftphoneState, detail?: string) => void;
  /** Remote audio to attach to an <audio> element. */
  onRemoteStream?: (stream: MediaStream) => void;
}

/**
 * One call's peer connection. Deliberately single-use: a Softphone is
 * created when a call starts and disposed when it ends, so no state from
 * a previous call can leak into the next one.
 */
export class Softphone {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private events: SoftphoneEvents;
  private disposed = false;

  constructor(events: SoftphoneEvents = {}) {
    this.events = events;
  }

  private setState(state: SoftphoneState, detail?: string) {
    if (this.disposed && state !== 'ended') return;
    this.events.onState?.(state, detail);
  }

  /** True when this browser can do WebRTC at all. Secure-context only:
   *  getUserMedia is unavailable over plain http (localhost excepted). */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof RTCPeerConnection !== 'undefined' &&
      Boolean(navigator?.mediaDevices?.getUserMedia)
    );
  }

  private async ensurePeer(): Promise<RTCPeerConnection> {
    if (this.pc) return this.pc;

    this.setState('requesting-mic');
    // Audio only — WhatsApp calling is voice. The processing constraints
    // matter on speakerphone, where without them the customer hears
    // their own voice back.
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.events.onRemoteStream?.(stream);
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this.setState('in-call');
          break;
        case 'failed':
          this.setState('failed', 'The audio connection could not be established.');
          break;
        case 'disconnected':
        case 'closed':
          this.setState('ended');
          break;
      }
    };

    this.pc = pc;
    return pc;
  }

  /**
   * Resolve once ICE gathering finishes — or after `timeoutMs`, taking
   * whatever candidates we have.
   *
   * The timeout is not a nicety. Gathering can stall indefinitely on an
   * unreachable STUN server, and a caller stuck behind this promise is a
   * phone that never rings. A partial candidate set usually still
   * connects; waiting forever never does.
   */
  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        pc.removeEventListener('icegatheringstatechange', onChange);
        clearTimeout(timer);
        resolve();
      };
      const onChange = () => {
        if (pc.iceGatheringState === 'complete') finish();
      };
      const timer = setTimeout(finish, timeoutMs);
      pc.addEventListener('icegatheringstatechange', onChange);
    });
  }

  /** Create the offer for an outbound call. Returns a complete SDP. */
  async createOffer(): Promise<string> {
    const pc = await this.ensurePeer();
    this.setState('negotiating');
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    await this.waitForIceGathering(pc);
    this.setState('connecting');
    return pc.localDescription?.sdp ?? offer.sdp ?? '';
  }

  /** Apply the customer's answer to an outbound call we placed. */
  async acceptAnswer(sdp: string): Promise<void> {
    const pc = this.pc;
    if (!pc) throw new Error('No call in progress.');
    // A late duplicate of the answer webhook would otherwise throw here
    // and tear down a call that is already up.
    if (pc.signalingState === 'stable') return;
    await pc.setRemoteDescription({ type: 'answer', sdp });
  }

  /** Answer an inbound call. Takes the customer's offer, returns ours. */
  async answerOffer(offerSdp: string): Promise<string> {
    const pc = await this.ensurePeer();
    this.setState('negotiating');
    await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.waitForIceGathering(pc);
    this.setState('connecting');
    return pc.localDescription?.sdp ?? answer.sdp ?? '';
  }

  /** Mute or unmute the microphone. Returns the new muted state. */
  setMuted(muted: boolean): boolean {
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
    return muted;
  }

  /** Release the microphone and tear the peer connection down. Safe to
   *  call twice — hanging up and a terminate webhook often both land. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;
    try {
      this.pc?.close();
    } catch {
      // Already closed — nothing to do.
    }
    this.pc = null;
    this.setState('ended');
  }
}
