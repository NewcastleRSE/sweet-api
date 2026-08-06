import type { Schema, Struct } from '@strapi/strapi';

export interface BlocksAccordion extends Struct.ComponentSchema {
  collectionName: 'components_blocks_accordions';
  info: {
    displayName: 'Accordion';
    icon: 'list';
  };
  attributes: {
    items: Schema.Attribute.Component<'components.accordion-item', true>;
  };
}

export interface BlocksInteractiveTool extends Struct.ComponentSchema {
  collectionName: 'components_blocks_interactive_tools';
  info: {
    displayName: 'Interactive Tool';
    icon: 'cog';
  };
  attributes: {
    config: Schema.Attribute.JSON;
    tool_type: Schema.Attribute.String;
  };
}

export interface BlocksMarkdown extends Struct.ComponentSchema {
  collectionName: 'components_blocks_markdowns';
  info: {
    displayName: 'Markdown';
    icon: 'file';
  };
  attributes: {
    encoding: Schema.Attribute.String;
    text: Schema.Attribute.RichText;
  };
}

export interface BlocksMenu extends Struct.ComponentSchema {
  collectionName: 'components_blocks_menus';
  info: {
    displayName: 'Menu';
    icon: 'apps';
  };
  attributes: {
    items: Schema.Attribute.Component<'components.menu-item', true>;
    menu_type: Schema.Attribute.String;
  };
}

export interface BlocksPartnerCarousel extends Struct.ComponentSchema {
  collectionName: 'components_blocks_partner_carousels';
  info: {
    displayName: 'Partner Carousel';
    icon: 'landscape';
  };
  attributes: {
    autostart: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    controls: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    indicators: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    name: Schema.Attribute.String;
    partners: Schema.Attribute.Component<'components.partner-item', true>;
  };
}

export interface BlocksPopup extends Struct.ComponentSchema {
  collectionName: 'components_blocks_popups';
  info: {
    displayName: 'Popup';
    icon: 'layer';
  };
  attributes: {
    body: Schema.Attribute.RichText;
    name_key: Schema.Attribute.String;
    quotes: Schema.Attribute.Component<'components.quote', true>;
    size: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface BlocksQuoteBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_quote_blocks';
  info: {
    displayName: 'Quote Block';
    icon: 'quote';
  };
  attributes: {
    quote_details: Schema.Attribute.Component<'components.quote', false>;
  };
}

export interface BlocksStandout extends Struct.ComponentSchema {
  collectionName: 'components_blocks_standouts';
  info: {
    displayName: 'Standout';
    icon: 'information';
  };
  attributes: {
    class: Schema.Attribute.String;
    text: Schema.Attribute.Text;
  };
}

export interface ComponentsAccordionItem extends Struct.ComponentSchema {
  collectionName: 'components_component_accordion_items';
  info: {
    displayName: 'accordion-item';
  };
  attributes: {
    body: Schema.Attribute.RichText;
    header: Schema.Attribute.String;
    icon: Schema.Attribute.String;
    media: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    quotes: Schema.Attribute.Component<'components.quote', true>;
  };
}

export interface ComponentsItems extends Struct.ComponentSchema {
  collectionName: 'components_component_items';
  info: {
    displayName: 'items';
  };
  attributes: {
    header: Schema.Attribute.String;
    icon: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

export interface ComponentsMenuItem extends Struct.ComponentSchema {
  collectionName: 'components_component_menu_items';
  info: {
    displayName: 'menu_item';
  };
  attributes: {
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.String;
    link: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Schema.Attribute.String;
  };
}

export interface ComponentsPartnerItem extends Struct.ComponentSchema {
  collectionName: 'components_components_partner_items';
  info: {
    displayName: 'Partner Item';
    icon: 'picture';
  };
  attributes: {
    logo: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface ComponentsQuote extends Struct.ComponentSchema {
  collectionName: 'components_components_quotes';
  info: {
    displayName: 'Quote';
    icon: 'quote';
  };
  attributes: {
    citation: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    text: Schema.Attribute.Text;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'blocks.accordion': BlocksAccordion;
      'blocks.interactive-tool': BlocksInteractiveTool;
      'blocks.markdown': BlocksMarkdown;
      'blocks.menu': BlocksMenu;
      'blocks.partner-carousel': BlocksPartnerCarousel;
      'blocks.popup': BlocksPopup;
      'blocks.quote-block': BlocksQuoteBlock;
      'blocks.standout': BlocksStandout;
      'components.accordion-item': ComponentsAccordionItem;
      'components.items': ComponentsItems;
      'components.menu-item': ComponentsMenuItem;
      'components.partner-item': ComponentsPartnerItem;
      'components.quote': ComponentsQuote;
    }
  }
}
