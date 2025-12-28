
import { GoogleGenAI, Type } from "@google/genai";
import { NicheAnalysis, PinStrategy, ProductInput, ViralExpertReport, LayoutType, EngagementStyle, GeneratedPin } from "../types";

const handleApiError = (e: any) => {
  const msg = e.message || "";
  console.error("Gemini API Error:", msg);
  if (msg.includes("permission denied") || msg.includes("Requested entity was not found") || msg.includes("API_KEY_INVALID")) {
    throw new Error("P_KEY_RESET");
  }
  throw e;
};

export const analyzeNiche = async (input: ProductInput): Promise<NicheAnalysis> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Deep Analysis of Brand/Product: "${input.urlOrName}".
      Keywords: ${input.manualKeywords || 'None'}.
      
      TASK: Identify the "Pattern Interrupt" factor for this brand on Pinterest. 
      CORE FOCUS: Target female users who are tired of being sold to. 
      TONE DIRECTIVE: ${input.humorLevel === 'unhinged' ? 'Completely unhinged, dramatic, and hilariously relatable.' : input.humorLevel === 'sarcastic' ? 'Dry, witty, and slightly savage.' : 'Friendly, supportive, and helpful.'}
      Use deep emotional triggers like "Validation through overconsumption," "Sarcastic Empowerment," and "Relatable Chaos."
      Identify raw emotional triggers and define a color palette that is high-contrast, trendy (gen-z/millennial female aesthetic), and attention-grabbing.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            niche: { type: Type.STRING },
            visualStyle: { type: Type.STRING },
            colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            expandedKeywords: {
              type: Type.OBJECT,
              properties: {
                longTail: { type: Type.ARRAY, items: { type: Type.STRING } },
                midTail: { type: Type.ARRAY, items: { type: Type.STRING } },
                buyingIntent: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['longTail', 'midTail', 'buyingIntent']
            },
            audiencePainPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            ctaTone: { type: Type.STRING },
          },
          required: ['niche', 'visualStyle', 'colorPalette', 'keywords', 'expandedKeywords', 'audiencePainPoints', 'ctaTone'],
        },
      },
    });

    if (!response.text) throw new Error("Analysis failed");
    return JSON.parse(response.text) as NicheAnalysis;
  } catch (e) {
    return handleApiError(e);
  }
};

export const generatePinStrategies = async (
  analysis: NicheAnalysis,
  count: number,
  humorLevel: 'friendly' | 'sarcastic' | 'unhinged',
  availableKeywords: string[],
  imperfectionType: ProductInput['imperfectionType'] = 'none'
): Promise<PinStrategy[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let humorPrompt = "";
    if (humorLevel === 'unhinged') {
      humorPrompt = `YOU ARE AN UNHINGED FEMALE MARKETING SAVANT. Use humor like "I'm literally just a girl," "Me thinking I have money," or "POV: You're making a chaotic decision." Be over-the-top, slightly dramatic, and loud.`;
    } else if (humorLevel === 'sarcastic') {
      humorPrompt = `YOU ARE A DRY, WITTY SAVANT. Use sarcasm to point out why the user 'needs' this to fix their life. Be dry, judgmental but in a funny way, and sophisticatedly savage.`;
    } else {
      humorPrompt = `YOU ARE A HELPFUL BESTIE. Be wholesome, supportive, and use soft puns. Focus on genuine benefits and aesthetic inspiration.`;
    }

    const prompt = `
      ${humorPrompt}
      GENERATE ${count} ARRESTING PIN STRATEGIES for: ${JSON.stringify(availableKeywords)}.

      TARGET: Millennial/Gen-Z women. 
      
      STYLE RULES:
      - Headlines: Must match the ${humorLevel} tone. If unhinged, use caps or dramatic punctuation.
      - Subheadlines: The "too real" inner monologue.
      - CTAs: If unhinged, make them pushy but funny (e.g., "Add to cart, it's cheaper than therapy").

      FOR EACH PIN, PROVIDE A "viralExpert" AUDIT:
      - viralScore: 0-100.
      - critique: Be a savage critic. Why is this pin mid?
      - hookImprovement: A truly scroll-stopping alternative headline.
      - seoStrength: Search intent matching.

      IMPERFECTION SETTING: User selected "${imperfectionType}". 
      Set "imperfectionLevel" (0-10).

      OUTPUT AS JSON ARRAY.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              targetKeyword: { type: Type.STRING },
              headline: { type: Type.STRING },
              subheadline: { type: Type.STRING },
              cta: { type: Type.STRING },
              imagePrompt: { type: Type.STRING },
              layout: { type: Type.STRING },
              engagementStyle: { type: Type.STRING },
              primaryColor: { type: Type.STRING },
              secondaryColor: { type: Type.STRING },
              fontPairing: { type: Type.STRING },
              marketingAngle: { type: Type.STRING },
              imperfectionLevel: { type: Type.NUMBER },
              viralExpert: {
                type: Type.OBJECT,
                properties: {
                  viralScore: { type: Type.NUMBER },
                  critique: { type: Type.STRING },
                  hookImprovement: { type: Type.STRING },
                  seoStrength: { type: Type.NUMBER },
                },
                required: ['viralScore', 'critique', 'hookImprovement', 'seoStrength']
              }
            },
            required: ['targetKeyword', 'headline', 'subheadline', 'cta', 'imagePrompt', 'layout', 'engagementStyle', 'primaryColor', 'secondaryColor', 'fontPairing', 'marketingAngle', 'imperfectionLevel', 'viralExpert'],
          },
        },
      },
    });

    if (!response.text) throw new Error("Strategy generation failed");
    const strategies = JSON.parse(response.text) as any[];
    return strategies.map(s => ({ ...s, id: crypto.randomUUID(), imperfectionType }));
  } catch (e) {
    return handleApiError(e);
  }
};

export const generatePinImage = async (imagePrompt: string, layout: LayoutType, preferredStyle: ProductInput['visualStyle'] = 'realistic'): Promise<string> => {
  const tryGenerate = async (modelName: string, size: "1K" | "2K" | "4K"): Promise<string | null> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const finalPrompt = `
        A high-impact Pinterest hero image targeting a female aesthetic.
        SUBJECT: ${imagePrompt}.
        STYLE: ${preferredStyle}, hyper-detailed, vibrant.
        VIBE: High-quality editorial or "Relatable Aesthetic Chaos".
        STRICT: No text, no logos.
      `;

      const config: any = { 
        imageConfig: { 
          aspectRatio: "9:16"
        } 
      };
      
      if (modelName === 'gemini-3-pro-image-preview') {
        config.imageConfig.imageSize = size;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [{ text: finalPrompt }] },
        config: config
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    } catch (e: any) {
      if ((e.message || "").includes("permission denied")) throw new Error("P_KEY_RESET");
    }
    return null;
  };

  const proResult = await tryGenerate('gemini-3-pro-image-preview', "2K");
  if (proResult) return proResult;

  const flashResult = await tryGenerate('gemini-2.5-flash-image', "1K");
  if (flashResult) return flashResult;

  return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop`;
};

export const generatePinVideo = async (pin: GeneratedPin, visualStyle: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `A dynamic promotional video for ${pin.targetKeyword}. 
    Headline: ${pin.headline}. 
    Style: ${visualStyle}, energetic social media aesthetic.`;

    let imagePayload: any = undefined;
    if (pin.imageUrl && pin.imageUrl.startsWith('data:')) {
      const [mimeInfo, base64Data] = pin.imageUrl.split(',');
      const mimeType = mimeInfo.split(':')[1].split(';')[0];
      imagePayload = {
        imageBytes: base64Data,
        mimeType: mimeType
      };
    }

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: imagePayload,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed.");

    const fetchUrl = `${downloadLink}&key=${process.env.API_KEY}`;
    const response = await fetch(fetchUrl);
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
  } catch (e: any) {
    if ((e.message || "").includes("permission denied") || (e.message || "").includes("Requested entity was not found")) {
      throw new Error("P_KEY_RESET");
    }
    throw e;
  }
};
