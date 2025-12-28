
export interface ProductInput {
  urlOrName: string;
  manualKeywords?: string;
  brandVoice?: string;
  targetDemographic?: string;
  pinCount: number;
  humorLevel: 'friendly' | 'sarcastic' | 'unhinged';
  visualStyle: 'modern' | 'retro' | 'classic' | 'cartoonie' | 'realistic' | 'high-tech' | 'abstract' | 'magazine-cutout' | 'photo-collage' | 'abstract-data-viz' | 'schematic-blueprint' | 'brutalist' | 'neon-noir' | 'vaporwave' | '3d-claymation' | 'minimal-editorial';
  imperfectionType: 'none' | 'organic' | 'gritty' | 'hand-drawn' | 'analog';
  strictKeywordMode?: boolean; 
  destinationUrl?: string; 
  rssUrl?: string;
  sourceType: 'brand' | 'rss';
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
}

export interface NicheAnalysis {
  niche: string;
  visualStyle: string;
  colorPalette: string[];
  keywords: string[];
  expandedKeywords: {
    longTail: string[];
    midTail: string[];
    buyingIntent: string[];
  };
  audiencePainPoints: string[];
  ctaTone: string;
}

export type EngagementStyle = 
  | 'CHAOTIC_HUMAN_MOMENT'
  | 'VISUAL_ROAST'
  | 'EXAGGERATED_METAPHOR'
  | 'SCREENSHOT_FAKE_UI'
  | 'BEFORE_AFTER_CHAOS'
  | 'UGLY_ON_PURPOSE'
  | 'OBJECT_AS_PROTAGONIST';

export type LayoutType = 
  | 'tech-glassmorphism'
  | 'cyber-glow'
  | 'modern-minimal-product'
  | 'floating-ui'
  | 'diagnostic-grid'
  | 'blueprint-tech'
  | 'brutalist-spec'
  | 'glitch-scanline'
  | 'holographic-card'
  | 'circuit-overlay'
  | 'neon-wireframe'
  | 'minimal-frame'
  | 'magazine-cutout'
  | 'split-vertical'
  | 'realistic-lifestyle'
  | 'abstract-data-viz'
  | 'macro-hardware'
  | 'schematic-dark'
  | 'minimalist-poster'
  | 'photo-collage'
  | 'editorial-grid';

export type FontPairing = 'modern-bold' | 'elegant-serif' | 'playful-hand' | 'editorial' | 'retro-pop' | 'minimal-sans' | 'tech-mono' | 'future-heavy';

export interface ViralExpertReport {
  viralScore: number;
  critique: string;
  hookImprovement: string;
  seoStrength: number;
}

export interface PinStrategy {
  id: string;
  targetKeyword: string;
  headline: string;
  subheadline: string;
  cta: string;
  imagePrompt: string;
  layout: LayoutType;
  engagementStyle: EngagementStyle;
  primaryColor: string;
  secondaryColor: string;
  fontPairing: FontPairing;
  marketingAngle: 'urgency' | 'curiosity' | 'benefit' | 'problem-solution' | 'emotional' | 'bold' | 'sassy' | 'cozy' | 'dad-humor' | 'aspirational' | 'snarky-truth' | 'existential-dread' | 'high-tech-flex';
  imperfectionLevel: number;
  imperfectionType: 'none' | 'organic' | 'gritty' | 'hand-drawn' | 'analog';
  viralExpert?: ViralExpertReport;
}

export interface GeneratedPin extends PinStrategy {
  imageUrl: string;
  videoUrl?: string;
  status: 'pending' | 'generating_strategy' | 'generating_image' | 'completed' | 'failed' | 'generating_video';
  postedToPinterest?: boolean;
  pinterestPinId?: string;
  pinterestError?: string;
  postedToVideo?: boolean;
}

export interface PinterestBoard {
  id: string;
  name: string;
  url: string;
}

export interface Project {
  id: string;
  timestamp: number;
  name: string;
  input: ProductInput;
  analysis: NicheAnalysis | null;
  pins: GeneratedPin[];
}
