-- zoteamo schema (spec §3), plus items.title: a derived plain-text heading for each item.
CREATE TABLE lists (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  default_style   TEXT NOT NULL DEFAULT 'apa' CHECK (default_style IN ('apa','mla','chicago')),
  view_token      TEXT NOT NULL UNIQUE,
  edit_token_hash TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE items (
  id              TEXT PRIMARY KEY,
  list_id         TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  input           TEXT NOT NULL,
  input_kind      TEXT NOT NULL CHECK (input_kind IN ('url','doi','isbn','pmid','arxiv','manual')),
  title           TEXT NOT NULL DEFAULT '',
  zotero_json     TEXT,
  csl_json        TEXT,
  cite_apa        TEXT, cite_mla TEXT, cite_chicago TEXT,
  text_apa        TEXT, text_mla TEXT, text_chicago TEXT,
  bibtex          TEXT, ris TEXT, coins TEXT,
  citation_state  TEXT NOT NULL CHECK (citation_state IN ('pending','ready','failed')),
  citation_error  TEXT,
  added_by        TEXT NOT NULL DEFAULT '',
  note            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','up_next','discussed')),
  meeting_date    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX items_list ON items(list_id, created_at);

CREATE TABLE votes (
  item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  voter_id   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_id, voter_id)
);

CREATE TABLE lookup_cache (
  key         TEXT PRIMARY KEY,
  zotero_json TEXT NOT NULL,
  fetched_at  TEXT NOT NULL
);
