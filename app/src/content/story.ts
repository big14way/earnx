/**
 * The founder's story on the home page. Written from the founder's own account; the only outside
 * figure is the out-of-pocket health spending share (World Bank, 2023: 71.9%).
 */
export type FounderStory = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  signature: string;
  photo?: { src: string; alt: string; caption?: string };
};

export const founderStory: FounderStory | null = {
  eyebrow: "Why I'm building EarnX",
  title: "The money was already earned. It just wasn't in our hands.",
  paragraphs: [
    'My mother, Mama Dora, is a farmer in Delta State, Nigeria. She grows cassava and other crops, and for as long as I can remember her harvest has paid for everything in our home.',
    'Then my father had a stroke. The hospital needed money that week. Like most Nigerian families, we had no health insurance: of every ₦1,000 spent on healthcare in Nigeria, about ₦720 comes straight out of a family’s own pocket.',
    'It happened just after harvest, when a farmer has the most to show and the least cash in hand. What money she had went to the farmhands who had helped bring the crop in, and it still wasn’t enough to pay them all. The harvest was worth far more than the hospital bill, but it wasn’t money yet.',
    'So we did what farming families across Africa do. We sold part of the crop cheaply, just to get cash quickly, and we went to the bank. Between the fees and the interest rate, the loan cost far more than we could carry, and it bankrupted us.',
    'I built EarnX so that the value of work already done reaches people when they need it, at a fair price. We start with African exporters, whose invoices we can verify on-chain today. Every invoice we fund is a family that doesn’t have to choose between the harvest and the hospital.',
  ],
  signature: '— Godswill Idolor, founder, and son of a Delta State farmer',
  photo: {
    src: '/story/mama-dora.jpg',
    alt: 'Mama Dora, the founder’s mother, holding a basket of fresh produce on her farm',
    caption: 'Mama Dora on her farm',
  },
};
