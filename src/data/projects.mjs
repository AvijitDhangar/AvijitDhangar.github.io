// Workshop entries.
// status: 'active' | 'completed' | 'paused' | 'idea'
export const projects = [
  {
    title: 'Keyboard Layout',
    description: 'An exploration into custom keymaps, ergonomics, and typing efficiency.',
    why: 'Questioning standard QWERTY defaults to minimize finger travel and fatigue.',
    tech: ['Python', 'Ergonomics', 'Keymaps'],
    status: 'active',
    link: 'https://github.com/Avijit-D/keyboard-layout',
    topics: ['Systems'],
  },
  {
    title: 'Testcase Benchmark',
    description: 'A benchmarking suite for evaluating test generation accuracy and edge-case execution.',
    why: 'Testing edge-case limits and finding what breaks before hitting production.',
    tech: ['Python', 'Benchmarking', 'Testing'],
    status: 'completed',
    link: 'https://github.com/Avijit-D/testcase-benchmark',
    topics: ['Technology & AI'],
  },
  {
    title: 'UPI Transaction Analyser',
    description: 'A privacy-first parser and analysis tool for UPI bank statements.',
    why: 'Visualizing spending habits and cash-flow patterns locally without third-party aggregators.',
    tech: ['Python', 'Data Analytics', 'Visualization'],
    status: 'completed',
    link: 'https://github.com/Avijit-D/upi-transaction-analyser',
    topics: ['Systems', 'Data Science'],
  },
  {
    title: 'OTD Realtime Visualisation',
    description: 'A high-frequency real-time telemetry and streaming data visualization interface.',
    why: 'Turning live streaming data streams into immediate, responsive visual signals.',
    tech: ['JavaScript', 'Realtime', 'Data Visualization'],
    status: 'completed',
    link: 'https://github.com/Avijit-D/otd-realtime-visualisation',
    article: 'https://medium.com/@avijitdhangar/untitled-document-md-bd5dc0a21b48',
    topics: ['Technology & AI', 'Data Science'],
  },
  {
    title: 'VelociRead',
    description: 'A speed-reading application utilizing rapid serial visual presentation (RSVP) pacing.',
    why: 'Built by vibe-coding the scaffolding to deeply learn and engineer the reading mechanics.',
    tech: ['JavaScript', 'Frontend', 'Rapid UI'],
    status: 'completed',
    link: 'https://github.com/Avijit-D/velociread',
    article: 'https://medium.com/@avijitdhangar/i-vibe-coded-half-my-app-so-i-could-actually-learn-the-other-half-e6f04dc97582',
    topics: ['Technology & AI'],
  },
  {
    title: 'Reddit Dashboard',
    description: 'An interactive analytics dashboard tracking discussions, trends, and subreddit sentiment.',
    why: 'Moving from uncertainty to discovery by mapping how communities actually communicate.',
    tech: ['Python', 'Reddit API', 'Analytics', 'Dashboard'],
    status: 'completed',
    link: 'https://github.com/Avijit-D/reddit-dashboard',
    article: 'https://medium.com/@avijitdhangar/from-doubt-to-dashboard-why-building-a-reddit-dashboard-changed-how-i-see-r-c7c6e256ca05',
    topics: ['Data Science', 'Technology & AI'],
  },
];

// Smaller things: experiments, scripts, workflows.
export const experiments = [];

// Live interactive tools people can try right in the browser
export const liveApps = [
  {
    title: 'KeyFit',
    description: 'An interactive tool to discover and test ergonomic keyboard layouts tailored to your typing style.',
    link: 'https://keyfit4u.vercel.app/',
  },
  {
    title: 'RangScience',
    description: 'An interactive exploration into color theory, contrast ratios, and color science.',
    link: 'https://rangscience.vercel.app/',
  },
  {
    title: 'VelociReader',
    description: 'A live speed-reading tool using RSVP pacing to train reading speed and comprehension.',
    link: 'https://velocireader.vercel.app/',
  },
];
