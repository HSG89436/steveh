
import { RssItem } from "../types";

const PROXY_URL = 'https://corsproxy.io/?';

export const fetchRssItems = async (rssUrl: string): Promise<RssItem[]> => {
  try {
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(rssUrl)}`);
    if (!response.ok) throw new Error("Failed to fetch RSS feed");
    
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    
    const items = xmlDoc.querySelectorAll("item");
    const result: RssItem[] = [];
    
    items.forEach(item => {
      const title = item.querySelector("title")?.textContent || "";
      const link = item.querySelector("link")?.textContent || "";
      const description = item.querySelector("description")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || "";
      
      // Basic cleanup of description (strip HTML)
      const cleanDescription = description.replace(/<[^>]*>?/gm, '').trim();
      
      if (title) {
        result.push({ title, link, description: cleanDescription, pubDate });
      }
    });
    
    return result;
  } catch (error) {
    console.error("RSS Fetch Error:", error);
    throw error;
  }
};
