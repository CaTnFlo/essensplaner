import { test } from "node:test";
import assert from "node:assert/strict";
import { bringLink, rezeptSeitenPfad } from "../js/bring.js";

test("bringLink kodiert die URL vollständig", () => {
  const url = "https://example.github.io/essensplaner/rezepte/nudel-baukasten--brokkoli-sahne.html?a=1&b=zwei drei#x";
  const l = bringLink(url);
  assert.equal(l, `https://api.getbring.com/rest/bringrecipes/deeplink?url=${encodeURIComponent(url)}&source=web`);
  const u = new URL(l);
  assert.equal(u.searchParams.get("url"), url);
  assert.equal(u.searchParams.get("source"), "web");
  assert.equal(u.searchParams.size, 2);
});

test("bringLink: einfache URL", () => {
  assert.equal(
    bringLink("https://example.org/r.html"),
    "https://api.getbring.com/rest/bringrecipes/deeplink?url=https%3A%2F%2Fexample.org%2Fr.html&source=web",
  );
});

test("rezeptSeitenPfad: ohne Varianten", () => {
  assert.equal(rezeptSeitenPfad({ quelle: "rezept", id: "lasagne", variante: null }), "rezepte/lasagne.html");
  assert.equal(rezeptSeitenPfad({ quelle: "rezept", id: "lasagne", variante: {} }), "rezepte/lasagne.html");
});

test("rezeptSeitenPfad: mit Varianten in Gruppenreihenfolge", () => {
  assert.equal(
    rezeptSeitenPfad({ quelle: "rezept", id: "nudel-baukasten", variante: { beilage: "brokkoli", sosse: "sahne" } }),
    "rezepte/nudel-baukasten--brokkoli-sahne.html",
  );
  assert.equal(
    rezeptSeitenPfad({ quelle: "rezept", id: "ofengemuese", variante: { dazu: "beides" } }),
    "rezepte/ofengemuese--beides.html",
  );
});

test("rezeptSeitenPfad: Link hat keine eigene Seite", () => {
  assert.equal(rezeptSeitenPfad({ quelle: "link", id: "link-1", variante: null }), null);
});
