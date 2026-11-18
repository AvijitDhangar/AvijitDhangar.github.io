// Long-term interests. These exist even before you write a note about them.
// To enrich one, publish an Obsidian note with `type: interest` and `topic: <name>`.
// `hue` colours the topic card and tag.
export const interests = [
  { name: 'Photography', hue: '#e8508a', blurb: 'Chasing light, fog and small things that only exist for a minute.' },
  { name: 'Colour Science', hue: '#7c4dff', blurb: 'How we see, measure and feel colour.' },
  { name: 'Geography', hue: '#1f9d6a', blurb: 'Why places look the way they do, from road markings to rooftops.' },
  { name: 'Storytelling', hue: '#e39b00', blurb: 'Fiction, structure and the craft of telling it well.' },
  { name: 'Roleplaying Games', hue: '#2b7fbf', blurb: 'Collaborative stories with several authors and no script.' },
  { name: 'OSINT', hue: '#0f8b8d', blurb: 'Finding things out from open sources, carefully and ethically.' },
  { name: 'Technology & AI', hue: '#4a6fe3', blurb: 'What we build, and what it does to the people using it.' },
  { name: 'Systems', hue: '#c25b1a', blurb: 'Goals, habits and the structures that quietly decide outcomes.' },
];

// Shown in "Currently exploring" until you publish a note with
// `type: exploration`, `status: current` (and ideally `featured: true`).
export const fallbackCurrent = {
  title: 'Colour Science',
  topic: 'Colour Science',
  description: 'Building a playful space to explore how we see, measure and feel colour.',
  threads: ['How screens and paint disagree', 'Colour in photography and editing', 'Palettes that feel like a place'],
};
