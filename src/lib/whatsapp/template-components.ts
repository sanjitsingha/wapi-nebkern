/**
 * Translate our local template row shape into the `components` array
 * shape that Meta's POST /{waba_id}/message_templates endpoint expects.
 *
 * Keep this function pure and JSON-shaped — the submit route and the
 * (future) edit route both call it, and unit tests assert the exact
 * payload by snapshot.
 *
 * Spec reference:
 *   https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components
 */

import type { TemplatePayload } from './template-validators';
import type { TemplateButton } from '@/types';

export interface MetaComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'CAROUSEL';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  // Authentication-template body/footer fields (mutually exclusive with text)
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
  buttons?: MetaButtonPayload[];
  /** Only for the CAROUSEL component — 2–10 cards. */
  cards?: MetaCard[];
  example?: {
    header_text?: string[];
    header_url?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
}

/** One card inside a CAROUSEL component — its own mini component set. */
export interface MetaCard {
  components: MetaComponent[];
}

interface MetaButtonPayload {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP';
  /** Only for OTP buttons. */
  otp_type?: 'COPY_CODE' | 'ZERO_TAP' | 'ONE_TAP';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

function buildHeaderComponent(payload: TemplatePayload): MetaComponent | null {
  const { header_type, header_content, header_media_url, header_handle } = payload;
  if (!header_type) return null;

  if (header_type === 'text') {
    const headerSample = payload.sample_values?.header;
    const component: MetaComponent = {
      type: 'HEADER',
      format: 'TEXT',
      text: header_content,
    };
    if (headerSample && headerSample.length > 0) {
      component.example = { header_text: headerSample };
    }
    return component;
  }

  const format =
    header_type === 'image'
      ? 'IMAGE'
      : header_type === 'video'
        ? 'VIDEO'
        : 'DOCUMENT';
  const component: MetaComponent = { type: 'HEADER', format };
  if (header_handle) {
    component.example = { header_handle: [header_handle] };
  } else if (header_media_url) {
    component.example = { header_url: [header_media_url] };
  }
  return component;
}

function buildBodyComponent(payload: TemplatePayload): MetaComponent {
  const component: MetaComponent = {
    type: 'BODY',
    text: payload.body_text,
  };
  const bodySample = payload.sample_values?.body;
  if (bodySample && bodySample.length > 0) {
    // Meta expects body_text as a 2D array — outer is "examples",
    // inner is the values for each variable. We submit a single
    // example row.
    component.example = { body_text: [bodySample] };
  }
  return component;
}

function buildFooterComponent(payload: TemplatePayload): MetaComponent | null {
  if (!payload.footer_text?.trim()) return null;
  return { type: 'FOOTER', text: payload.footer_text };
}

function buildButtonPayload(b: TemplateButton): MetaButtonPayload {
  switch (b.type) {
    case 'QUICK_REPLY':
      return { type: 'QUICK_REPLY', text: b.text };
    case 'URL': {
      const payload: MetaButtonPayload = {
        type: 'URL',
        text: b.text,
        url: b.url,
      };
      if (b.example) payload.example = [b.example];
      return payload;
    }
    case 'PHONE_NUMBER':
      return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
    case 'COPY_CODE':
      return { type: 'COPY_CODE', text: b.text, example: [b.example] };
  }
}

function buildButtonsComponent(payload: TemplatePayload): MetaComponent | null {
  if (!payload.buttons || payload.buttons.length === 0) return null;
  return {
    type: 'BUTTONS',
    buttons: payload.buttons.map(buildButtonPayload),
  };
}

/**
 * Build the CAROUSEL component from the template's cards. Each card
 * becomes its own `{ components: [HEADER, BODY, BUTTONS?] }`. The header
 * uses the card's Resumable-Upload handle when present (required by Meta
 * for media at creation) and falls back to the public URL otherwise.
 */
function buildCarouselComponent(payload: TemplatePayload): MetaComponent {
  const format = payload.carousel_card_format === 'video' ? 'VIDEO' : 'IMAGE';
  const cards: MetaCard[] = (payload.carousel_cards ?? []).map((card) => {
    const header: MetaComponent = { type: 'HEADER', format };
    if (card.media_handle) {
      header.example = { header_handle: [card.media_handle] };
    } else if (card.media_url) {
      header.example = { header_url: [card.media_url] };
    }

    const components: MetaComponent[] = [
      header,
      { type: 'BODY', text: card.body_text },
    ];
    if (card.buttons && card.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: card.buttons.map(buildButtonPayload),
      });
    }
    return { components };
  });

  return { type: 'CAROUSEL', cards };
}

export interface MetaTemplateSubmitPayload {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: MetaComponent[];
}

const CATEGORY_TO_META: Record<
  'Marketing' | 'Utility' | 'Authentication',
  MetaTemplateSubmitPayload['category']
> = {
  Marketing: 'MARKETING',
  Utility: 'UTILITY',
  Authentication: 'AUTHENTICATION',
};

/**
 * Authentication templates have a fixed structure: auto-generated body,
 * optional expiry footer, and a mandatory OTP button. Meta's API uses a
 * different component shape (no body text, OTP button type) so we build
 * it separately instead of reusing the standard helpers.
 */
function buildAuthMetaPayload(payload: TemplatePayload): MetaTemplateSubmitPayload {
  const auth = payload.sample_values?.auth ?? {};
  const components: MetaComponent[] = [];

  components.push({
    type: 'BODY',
    add_security_recommendation: auth.add_security_recommendation ?? false,
  });

  if (auth.code_expiration_minutes) {
    components.push({
      type: 'FOOTER',
      code_expiration_minutes: auth.code_expiration_minutes,
    });
  }

  const buttonText = payload.buttons?.[0]?.text?.trim() || 'Copy code';
  components.push({
    type: 'BUTTONS',
    buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: buttonText }],
  });

  return {
    name: payload.name,
    category: 'AUTHENTICATION',
    language: payload.language,
    components,
  };
}

/**
 * Assemble the full submit payload (name + category + language +
 * components in canonical order: HEADER → BODY → FOOTER → BUTTONS).
 */
export function buildMetaTemplatePayload(
  payload: TemplatePayload,
): MetaTemplateSubmitPayload {
  if (payload.category === 'Authentication') {
    return buildAuthMetaPayload(payload);
  }

  // Carousel: a top-level BODY "bubble" followed by the CAROUSEL of
  // cards. No standalone header/footer/buttons at the template level.
  if (payload.template_type === 'carousel') {
    return {
      name: payload.name,
      category: CATEGORY_TO_META[payload.category],
      language: payload.language,
      components: [buildBodyComponent(payload), buildCarouselComponent(payload)],
    };
  }

  const components: MetaComponent[] = [];
  const header = buildHeaderComponent(payload);
  if (header) components.push(header);
  components.push(buildBodyComponent(payload));
  const footer = buildFooterComponent(payload);
  if (footer) components.push(footer);
  const buttons = buildButtonsComponent(payload);
  if (buttons) components.push(buttons);

  return {
    name: payload.name,
    category: CATEGORY_TO_META[payload.category],
    language: payload.language,
    components,
  };
}
