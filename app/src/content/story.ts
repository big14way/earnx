/**
 * The founder's story shown on the home page. Left empty until the real story is written:
 * the section is hidden while this is null, so nothing invented ever ships.
 */
export type FounderStory = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  signature: string;
  photo?: { src: string; alt: string };
};

export const founderStory: FounderStory | null = null;
