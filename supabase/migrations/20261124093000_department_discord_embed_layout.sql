alter table public.department_discord_webhooks
  add column if not exists embed_title_template text not null default '',
  add column if not exists embed_footer text not null default 'ZONE-431',
  add column if not exists embed_author_name text not null default '',
  add column if not exists embed_author_url text not null default '',
  add column if not exists embed_thumbnail_url text not null default '',
  add column if not exists embed_image_url text not null default '',
  add column if not exists embed_timestamp boolean not null default true;

comment on column public.department_discord_webhooks.embed_title_template is 'Modèle du titre de l’Embed Discord, avec variables événementielles.';
comment on column public.department_discord_webhooks.embed_footer is 'Texte de pied de l’Embed Discord propre au département.';
comment on column public.department_discord_webhooks.embed_author_name is 'Nom de l’auteur affiché dans l’Embed Discord.';
comment on column public.department_discord_webhooks.embed_author_url is 'Lien HTTPS associé à l’auteur de l’Embed.';
comment on column public.department_discord_webhooks.embed_thumbnail_url is 'URL HTTPS de la miniature de l’Embed.';
comment on column public.department_discord_webhooks.embed_image_url is 'URL HTTPS de l’image principale de l’Embed.';
comment on column public.department_discord_webhooks.embed_timestamp is 'Indique si la date d’envoi est affichée dans l’Embed.';