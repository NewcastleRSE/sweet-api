import type { Schema, Struct } from '@strapi/strapi';

export interface BlocksAccordion extends Struct.ComponentSchema {
  collectionName: 'components_blocks_accordions';
  info: {
    displayName: 'accordion';
  };
  attributes: {
    item: Schema.Attribute.Component<'component.items', true>;
    items: Schema.Attribute.Component<'component.accordion-item', true>;
  };
}

export interface BlocksInteractiveTool extends Struct.ComponentSchema {
  collectionName: 'components_blocks_interactive_tools';
  info: {
    displayName: 'interactive_tool';
  };
  attributes: {
    config: Schema.Attribute.JSON;
    tool_type: Schema.Attribute.Enumeration<
      [
        'diary-calendar',
        'diarygraph',
        'goalsetter',
        'goalchecker',
        'reminders',
        'my-plans',
        'user-details-page',
      ]
    >;
  };
}

export interface BlocksMarkdown extends Struct.ComponentSchema {
  collectionName: 'components_blocks_markdowns';
  info: {
    displayName: 'markdown';
  };
  attributes: {
    encoding: Schema.Attribute.Enumeration<
      ['plain', 'lz-string:B64', 'lz:string:UTF16']
    >;
    text: Schema.Attribute.RichText;
  };
}

export interface BlocksMenu extends Struct.ComponentSchema {
  collectionName: 'components_blocks_menus';
  info: {
    displayName: 'menu';
  };
  attributes: {
    items: Schema.Attribute.Component<'component.menu-item', true>;
    menu_type: Schema.Attribute.Enumeration<
      ['standard', 'homepage-menu', 'described-menu']
    >;
  };
}

export interface BlocksPartnerCarousel extends Struct.ComponentSchema {
  collectionName: 'components_blocks_partner_carousels';
  info: {
    displayName: 'partner_carousel';
  };
  attributes: {
    autostart: Schema.Attribute.Boolean;
    controls: Schema.Attribute.Boolean;
    indicators: Schema.Attribute.Boolean;
    name: Schema.Attribute.String;
    partners: Schema.Attribute.Component<'component.partner-item', true>;
  };
}

export interface BlocksPopup extends Struct.ComponentSchema {
  collectionName: 'components_blocks_popups';
  info: {
    displayName: 'popup';
  };
  attributes: {
    body: Schema.Attribute.RichText;
    name_key: Schema.Attribute.String;
    quotes: Schema.Attribute.Component<'component.quotes', true>;
    size: Schema.Attribute.Enumeration<['sm', 'md', 'lg', 'xl']>;
    title: Schema.Attribute.String;
  };
}

export interface BlocksQuoteBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_quote_blocks';
  info: {
    displayName: 'quote_block';
  };
  attributes: {
    quote_details: Schema.Attribute.Component<'component.quotes', false>;
  };
}

export interface BlocksStandout extends Struct.ComponentSchema {
  collectionName: 'components_blocks_standouts';
  info: {
    displayName: 'standout';
  };
  attributes: {
    class: Schema.Attribute.Enumeration<
      ['so-important', 'so-alert', 'so-info']
    >;
    text: Schema.Attribute.Text;
  };
}

export interface ComponentAccordionItem extends Struct.ComponentSchema {
  collectionName: 'components_component_accordion_items';
  info: {
    displayName: 'accordion-item';
  };
  attributes: {
    body: Schema.Attribute.RichText;
    header: Schema.Attribute.String;
    icon: Schema.Attribute.String;
    quotes: Schema.Attribute.Component<'component.quotes', true>;
  };
}

export interface ComponentItems extends Struct.ComponentSchema {
  collectionName: 'components_component_items';
  info: {
    displayName: 'items';
  };
  attributes: {
    header: Schema.Attribute.String;
    icon: Schema.Attribute.String;
  };
}

export interface ComponentMenuItem extends Struct.ComponentSchema {
  collectionName: 'components_component_menu_items';
  info: {
    displayName: 'menu_item';
  };
  attributes: {
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.String;
    link: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface ComponentPartnerItem extends Struct.ComponentSchema {
  collectionName: 'components_component_partner_items';
  info: {
    displayName: 'partner_item';
  };
  attributes: {
    logo: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    name: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface ComponentQuotes extends Struct.ComponentSchema {
  collectionName: 'components_component_quotes';
  info: {
    displayName: 'quote';
  };
  attributes: {
    citation: Schema.Attribute.String;
    text: Schema.Attribute.Text;
  };
}

export interface SharedSeoMetadata extends Struct.ComponentSchema {
  collectionName: 'components_shared_seo_metadata';
  info: {
    displayName: 'seo_metadata';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text;
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
      'component.accordion-item': ComponentAccordionItem;
      'component.items': ComponentItems;
      'component.menu-item': ComponentMenuItem;
      'component.partner-item': ComponentPartnerItem;
      'component.quotes': ComponentQuotes;
      'shared.seo-metadata': SharedSeoMetadata;
    }
  }
}
