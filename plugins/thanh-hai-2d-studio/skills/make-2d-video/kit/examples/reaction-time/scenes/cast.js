// cast.js — one outfit per recurring character. Signature colour = identity; keep it identical in every shot.
// Integrated with Chibi Character System V2 (Tab 3 Character Library)
export const MAX = {
  id: 'chibi_max',
  name: 'Max',
  top: 'hoodie',
  color: '#d64a33',
  topColor2: '#b83822',
  head: 'none',
  hair: 'short',
  hairColor: '#4a3728',
  hairHighlight: '#7a5c43',
  skin: '#ffdfc4',
  legs: '#2e384d',
  shoes: '#1e1e24',
  shoeType: 'sneakers',
  blush: true
}; // "you", the hero

export const JAKE = {
  id: 'chibi_jake',
  name: 'Jake',
  top: 'tshirt',
  color: '#3a6ea5',
  topColor2: '#1d4ed8',
  head: 'cap',
  headColor: '#f2c21a',
  hair: 'spiky',
  hairColor: '#232029',
  hairHighlight: '#423d4c',
  skin: '#fcdcc6',
  legs: '#374151',
  shoes: '#111827',
  shoeType: 'sneakers',
  blush: false
}; // best friend

export const DOC = {
  id: 'chibi_doc',
  name: 'Doc',
  top: 'labcoat',
  color: '#f3f4f6',
  topColor2: '#cbd5e1',
  face: 'glasses',
  head: 'none',
  hair: 'side_part',
  hairColor: '#6b7280',
  hairHighlight: '#9ca3af',
  skin: '#ffe5d4',
  legs: '#1f2937',
  shoes: '#0f172a',
  shoeType: 'casual',
  blush: false
}; // scientist

export const CAST = [MAX, JAKE, DOC];
