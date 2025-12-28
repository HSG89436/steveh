
import React, { useState, useEffect, useRef } from 'react';
import { Layout, Sparkles, Download, RefreshCw, X, Send, StopCircle, Package, Check, Zap, ShieldCheck, Key, ImageIcon, Monitor, Rss, Link as LinkIcon, Trash2, Info, TrendingUp, AlertTriangle, Copy, Loader2, LogIn, Settings, Globe, ExternalLink, Play, Film, Layers, Ghost, Coffee, Flame, FileText, Laugh, Sliders } from 'lucide-react';
import { ProductInput, Project, GeneratedPin, PinterestBoard, RssItem } from './types';
import { analyzeNiche, generatePinStrategies, generatePinImage, generatePinVideo } from './services/geminiService';
import { saveProject, getProjects, deleteProject, savePinterestToken, getPinterestToken, clearPinterestToken } from './services/storageService';
import { fetchBoards, publishPin, getOAuthUrl, exchangeAuthCode, REQUIRED_APP_ID, getDetectedRedirectUri } from './services/pinterestService';
import { fetchRssItems } from './services/rssService';
import PinCanvas from './components/PinCanvas';
import JSZip from 'jszip';
import { toPng } from 'html-to-image';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const SARCASTIC_MESSAGES = [
  "Manifesting viral fame for your mid product...",
  "Consulting the oracle of Pinterest (a 24-year-old in sweatpants)...",
  "Adding 'aesthetic' grain to hide the lack of a marketing budget...",
  "Translating corporate speak into 'I'm literally crying right now'...",
  "Calculating the exact amount of sass required to interrupt a scroll...",
  "Rendering pixels that will definitely make your ex jealous...",
  "Bypassing common sense to achieve maximum engagement...",
  "Injecting 400% more personality than a LinkedIn post...",
  "Polishing the 'organic' imperfection so it looks expensive...",
  "Waiting for the AI to stop laughing at its own jokes...",
  "Generating content for people who buy things they don't need...",
];

const DEFAULT_INPUT: ProductInput = {
  urlOrName: '',
  manualKeywords: '',
  pinCount: 5,
  humorLevel: 'unhinged',
  visualStyle: 'modern',
  imperfectionType: 'organic',
  brandVoice: 'Savage, Unhinged & Sarcastic',
  targetDemographic: 'Women (Millennial/Gen-Z)',
  strictKeywordMode: true,
  destinationUrl: '',
  sourceType: 'brand'
};

export default function App() {
  const pinRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const [input, setInput] = useState<ProductInput>(DEFAULT_INPUT);
  const [globalImperfectionIntensity, setGlobalImperfectionIntensity] = useState(3);
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [sarcasticTip, setSarcasticTip] = useState<string>(SARCASTIC_MESSAGES[0]);
  const [shouldStop, setShouldStop] = useState(false);
  const [rssItems, setRssItems] = useState<RssItem[]>([]);

  const [pinterestUser, setPinterestUser] = useState<string | null>(null);
  const [pinterestToken, setPinterestToken] = useState<string | null>(null);
  const [boards, setBoards] = useState<PinterestBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  
  const [clientSecret, setClientSecret] = useState(localStorage.getItem('pinflow_client_secret') || (process.env as any).PINTEREST_CLIENT_SECRET || '');
  const [appId, setAppId] = useState(localStorage.getItem('pinflow_app_id') || '1539800');
  const [redirectUri, setRedirectUri] = useState(localStorage.getItem('pinflow_redirect_uri') || 'http://localhost:9002/api/pinterest/callback');
  
  const [publishingStatus, setPublishingStatus] = useState<{[key: string]: 'uploading...' | 'success' | 'failed' | 'video_ready' | 'generating_video'}>({});
  const [hasGeminiKey, setHasGeminiKey] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setSarcasticTip(SARCASTIC_MESSAGES[Math.floor(Math.random() * SARCASTIC_MESSAGES.length)]);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  useEffect(() => {
    const handlePinterestCallback = async () => {
      const url = new URL(window.location.href);
      const isCallbackRoute = url.pathname === '/api/pinterest/callback';
      const urlParams = url.searchParams;
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (!isCallbackRoute && !code && !error) return;

      if (error) {
        setAuthError(`Pinterest Auth Error: ${urlParams.get('error_description') || error}`);
        window.history.replaceState({}, document.title, '/');
        return;
      }

      if (code && state) {
        setIsAuthenticating(true);
        setAuthError(null);
        try {
          const storedState = localStorage.getItem('pinterest_auth_state');
          if (state !== storedState) throw new Error("Security state mismatch.");
          const secret = clientSecret || localStorage.getItem('pinflow_client_secret');
          const token = await exchangeAuthCode(appId, secret, code, redirectUri);
          savePinterestToken(token);
          await verifyAndLoadBoards(token);
          localStorage.removeItem('pinterest_auth_state');
        } catch (e: any) {
          setAuthError(e.message || "Cloud connection exchange failed.");
        } finally {
          setIsAuthenticating(false);
          window.history.replaceState({}, document.title, '/');
        }
      }
    };
    handlePinterestCallback();
  }, [appId, clientSecret, redirectUri]);

  useEffect(() => {
    setAllProjects(getProjects());
    const verifyKeyStatus = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        setHasGeminiKey(await window.aistudio.hasSelectedApiKey());
      }
    };
    verifyKeyStatus();
  }, []);

  const handleGeminiAuth = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasGeminiKey(true);
    }
  };

  useEffect(() => {
    const savedToken = getPinterestToken();
    if (savedToken) verifyAndLoadBoards(savedToken);
  }, []);

  const verifyAndLoadBoards = async (token: string) => {
    try {
      const fetchedBoards = await fetchBoards(token);
      setPinterestToken(token);
      setPinterestUser("Cloud Connected"); 
      setBoards(fetchedBoards);
      if (fetchedBoards.length > 0) setSelectedBoard(fetchedBoards[0].id);
    } catch (e) { 
      setPinterestUser(null);
      clearPinterestToken();
    }
  };

  const handleFetchRss = async () => {
    if (!input.rssUrl) return;
    setIsProcessing(true);
    setProgress('Stalking the RSS feed...');
    try {
      const items = await fetchRssItems(input.rssUrl);
      setRssItems(items);
    } catch (e) {
      alert("RSS Error: Failed to fetch feed.");
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const handleGenerate = async (isAppend: boolean = false) => {
    if (input.sourceType === 'brand' && !input.urlOrName && !input.manualKeywords) return;
    if (input.sourceType === 'rss' && rssItems.length === 0) return;
    if (!hasGeminiKey) return handleGeminiAuth();

    setIsProcessing(true);
    setShouldStop(false);
    setProgress('Waking up the digital ghost...');
    
    try {
      let analysis = project?.analysis;
      if (!analysis || !isAppend) {
        const analysisInput = input.sourceType === 'rss' ? { ...input, urlOrName: rssItems[0]?.title || 'RSS Stream' } : input;
        analysis = await analyzeNiche(analysisInput);
      }
      
      let itemsToProcess: any[] = [];
      if (input.sourceType === 'rss') {
        itemsToProcess = rssItems.slice(0, input.pinCount);
      } else {
        let kwSource = input.manualKeywords ? input.manualKeywords.split('\n').map(k => k.trim()).filter(Boolean) : analysis.keywords;
        itemsToProcess = kwSource.slice(0, input.pinCount).map(k => ({ title: k, link: input.destinationUrl }));
      }

      let currentProject: Project = (isAppend && project) ? { ...project } : {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        name: input.urlOrName || (input.sourceType === 'rss' ? 'RSS Automation' : 'Market Campaign'),
        input: { ...input },
        analysis: analysis,
        pins: []
      };
      setProject(currentProject);

      for (let i = 0; i < itemsToProcess.length; i++) {
          if (shouldStop) break;
          const item = itemsToProcess[i];
          const keyword = item.title || item;
          
          setProgress(`Generating ${input.humorLevel} vibes: ${i + 1}/${itemsToProcess.length}`);
          const strats = await generatePinStrategies(analysis, 1, input.humorLevel, [keyword], input.imperfectionType);
          
          if (strats && strats[0]) {
            // Force global imperfection intensity
            const pinBase: GeneratedPin = { 
              ...strats[0], 
              imageUrl: '', 
              status: 'pending' as const,
              imperfectionLevel: globalImperfectionIntensity * 2 // Scaled for internal 0-10 use
            };
            setProject(prev => prev ? ({ ...prev, pins: [...prev.pins, pinBase] }) : null);

            setProgress(`Rendering hero for "${keyword.slice(0, 15)}..."`);
            const img = await generatePinImage(pinBase.imagePrompt, pinBase.layout, input.visualStyle);
            
            setProject(prev => {
              if (!prev) return null;
              const updatedPins = prev.pins.map(p => p.id === pinBase.id ? { ...p, imageUrl: img || '', status: 'completed' as const } : p);
              const updatedProject = { ...prev, pins: updatedPins };
              saveProject(updatedProject);
              return updatedProject;
            });
          }
      }
    } catch (e: any) {
      if (e.message === "P_KEY_RESET") setHasGeminiKey(false);
    } finally {
      setIsProcessing(false);
      setProgress('');
      setAllProjects(getProjects());
    }
  };

  const handleGenerateVideo = async (pinId: string) => {
    if (!project) return;
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) await window.aistudio.openSelectKey();
    setPublishingStatus(prev => ({ ...prev, [pinId]: 'generating_video' }));
    try {
      const pin = project.pins.find(p => p.id === pinId);
      if (!pin) return;
      const videoUrl = await generatePinVideo(pin, input.visualStyle);
      setProject(prev => {
        if (!prev) return null;
        const updatedPins = prev.pins.map(p => p.id === pinId ? { ...p, videoUrl: videoUrl, postedToVideo: true } : p);
        const updatedProject = { ...prev, pins: updatedPins };
        saveProject(updatedProject);
        return updatedProject;
      });
      setPublishingStatus(prev => ({ ...prev, [pinId]: 'video_ready' }));
    } catch (e: any) {
      if (e.message === "P_KEY_RESET") setHasGeminiKey(false);
      setPublishingStatus(prev => ({ ...prev, [pinId]: 'failed' }));
    }
  };

  const handleExportCSV = () => {
    if (!project || project.pins.length === 0) return;
    const headers = ["Pin Title", "Pin Description", "Keywords", "Hashtags", "Image URL", "Destination URL", "viralScore", "critique", "hookImprovement", "seoStrength"];
    const escapeCSV = (str: string) => !str ? '""' : `"${str.replace(/"/g, '""')}"`;
    const rows = project.pins.map(pin => {
      const description = `${pin.subheadline} ${pin.cta}`;
      const hashtags = `#${pin.targetKeyword.replace(/\s+/g, '')} #viral #aesthetic #unhinged`;
      return [escapeCSV(pin.headline), escapeCSV(description), escapeCSV(pin.targetKeyword), escapeCSV(hashtags), escapeCSV(pin.imageUrl), escapeCSV(project.input.destinationUrl || "https://pinterest.com"), pin.viralExpert?.viralScore || 0, escapeCSV(pin.viralExpert?.critique || ""), escapeCSV(pin.viralExpert?.hookImprovement || ""), pin.viralExpert?.seoStrength || 0].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `PINFLOW_BULK_${project.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportZip = async () => {
    if (!project) return;
    setIsProcessing(true);
    setProgress('Packaging Assets...');
    try {
      const zip = new JSZip();
      const readyPins = project.pins.filter(p => p.status === 'completed');
      for (const p of readyPins) {
        const element = pinRefs.current[p.id];
        if (element) {
          const dataUrl = await toPng(element, { pixelRatio: 2.5 });
          zip.file(`${p.targetKeyword.replace(/ /g, '_')}.png`, dataUrl.split(',')[1], { base64: true });
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `PINFLOW_EXPORT_${project.name}.zip`;
      link.click();
    } catch (e) { console.error(e); } finally { setIsProcessing(false); setProgress(''); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-pinterest selection:text-white">
      <header className="border-b border-white/5 bg-black/60 backdrop-blur-2xl h-16 flex items-center justify-between px-8 sticky top-0 z-[100]">
         <div className="flex items-center gap-3 font-black text-xl tracking-tighter uppercase">
            <Flame className="text-pinterest animate-pulse" size={24} /> PINFLOW <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] text-pinterest font-mono tracking-widest italic font-black">UNHINGED_V3</span>
         </div>
         <div className="flex gap-4 items-center">
             {!hasGeminiKey ? (
               <button onClick={handleGeminiAuth} className="bg-blue-600 px-4 py-2 rounded-full text-[10px] font-black flex items-center gap-2 animate-pulse shadow-lg shadow-blue-500/20">
                 <Monitor size={14}/> ACTIVATE PRO ENGINE
               </button>
             ) : (
               <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-[10px] font-black text-green-400 rounded-full flex items-center gap-2">
                 <Check size={12}/> AI FULLY LOADED
               </div>
             )}
             {pinterestUser ? (
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-pinterest/10 border border-pinterest/20 text-[10px] font-black text-pinterest rounded-full uppercase tracking-widest">CLOUD CONNECTED</div>
                  <button onClick={() => { clearPinterestToken(); window.location.reload(); }} className="bg-white/5 p-2 rounded-full hover:bg-red-900 transition-colors"><X size={16}/></button>
                </div>
             ) : (
                <button onClick={() => setShowApiModal(true)} className="bg-pinterest px-6 py-2 rounded-full text-[10px] font-black hover:scale-105 active:scale-95 transition-all uppercase tracking-widest shadow-xl shadow-red-900/20">ACCESS CLOUD</button>
             )}
         </div>
      </header>

      <main className="p-8 max-w-[1500px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
         <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#111] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl sticky top-24 overflow-y-auto max-h-[85vh] scrollbar-hide">
               <div className="flex justify-between items-center mb-8">
                 <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-2">
                   <Zap size={14} className="text-pinterest"/> Control Panel
                 </h2>
                 <div className="flex bg-black rounded-xl p-1 border border-white/5">
                    <button onClick={() => setInput({...input, sourceType: 'brand'})} className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${input.sourceType === 'brand' ? 'bg-[#222] text-white' : 'text-gray-500'}`}>BRAND</button>
                    <button onClick={() => setInput({...input, sourceType: 'rss'})} className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${input.sourceType === 'rss' ? 'bg-[#222] text-white' : 'text-gray-500'}`}>RSS</button>
                 </div>
               </div>

               <div className="space-y-6">
                  {input.sourceType === 'brand' ? (
                    <>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-white/30 mb-3 block tracking-[0.2em]">What are we selling today?</label>
                        <input className="w-full bg-black border border-white/10 p-4 rounded-2xl text-sm focus:ring-1 focus:ring-pinterest outline-none placeholder:text-white/5 font-bold" placeholder="e.g. Designer Cat Collars" value={input.urlOrName} onChange={e => setInput({...input, urlOrName: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-white/30 mb-3 block tracking-[0.2em]">Keyword Bank (The "Why")</label>
                        <textarea className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[10px] h-32 focus:ring-1 focus:ring-pinterest outline-none font-mono resize-none placeholder:text-white/5" value={input.manualKeywords} onChange={e => setInput({...input, manualKeywords: e.target.value})} placeholder="aesthetic cat lifestyle&#10;spoiled pet hacks&#10;expensive kitty decor" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-white/30 mb-3 block tracking-[0.2em]">RSS FEED URL</label>
                        <div className="flex gap-2">
                          <input className="flex-1 bg-black border border-white/10 p-4 rounded-2xl text-xs focus:ring-1 focus:ring-pinterest outline-none font-mono text-white/60" placeholder="https://site.com/feed" value={input.rssUrl || ''} onChange={e => setInput({...input, rssUrl: e.target.value})} />
                          <button onClick={handleFetchRss} className="bg-[#222] px-5 rounded-2xl hover:bg-pinterest transition-all"><Rss size={18}/></button>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                    <label className="text-[10px] uppercase font-bold text-white/30 block tracking-[0.2em] flex items-center gap-2">
                      <Layers size={12} className="text-pinterest"/> Batch Size
                    </label>
                    <input type="number" min="1" max="20" className="bg-black border border-white/10 p-3 rounded-2xl w-full text-pinterest font-black" value={input.pinCount} onChange={e => setInput({...input, pinCount: parseInt(e.target.value) || 1})} />
                  </div>

                  {/* Humor Level Selector */}
                  <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                    <label className="text-[10px] uppercase font-bold text-white/30 block tracking-[0.2em] flex items-center gap-2">
                      <Laugh size={12} className="text-pinterest"/> Chaos Core (Humor Level)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                       {(['friendly', 'sarcastic', 'unhinged'] as const).map(lvl => (
                         <button 
                           key={lvl} 
                           onClick={() => setInput({...input, humorLevel: lvl})}
                           className={`py-2 px-1 text-[8px] font-black uppercase tracking-widest rounded-xl border transition-all ${input.humorLevel === lvl ? 'bg-pinterest border-pinterest text-white' : 'bg-black border-white/5 text-white/30 hover:text-white/60'}`}
                         >
                           {lvl}
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Imperfection Engineering Section */}
                  <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-6">
                    <h3 className="text-[10px] font-black text-pinterest uppercase tracking-[0.3em] flex items-center gap-2"><Sliders size={12}/> Imperfection Engine</h3>
                    
                    <div>
                      <label className="text-[8px] uppercase font-bold text-white/20 block mb-2">Style Filter</label>
                      <select className="w-full bg-black border border-white/10 p-3 rounded-xl text-[10px] font-black outline-none" value={input.imperfectionType} onChange={e => setInput({...input, imperfectionType: e.target.value as any})}>
                         <option value="none">STRICT_PERFECTION</option>
                         <option value="organic">ORGANIC_TEXTURE</option>
                         <option value="gritty">GRITTY_TEXT_SHIFT</option>
                         <option value="analog">ANALOG_ABERRATION</option>
                         <option value="hand-drawn">HAND_CRAFTED_SKETCH</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                         <label className="text-[8px] uppercase font-bold text-white/20">Intensity</label>
                         <span className="text-[9px] font-black text-pinterest">{globalImperfectionIntensity}/5</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="5" 
                        step="1" 
                        className="w-full accent-pinterest bg-white/10 h-1 rounded-full appearance-none cursor-pointer" 
                        value={globalImperfectionIntensity} 
                        onChange={e => setGlobalImperfectionIntensity(parseInt(e.target.value))} 
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-6">
                    <h3 className="text-[10px] font-black text-pinterest uppercase tracking-[0.3em] flex items-center gap-2"><Sparkles size={12}/> Vibe Check</h3>
                    <select className="w-full bg-black border border-white/10 p-3 rounded-xl text-[10px] font-black outline-none" value={input.visualStyle} onChange={e => setInput({...input, visualStyle: e.target.value as any})}>
                       <option value="magazine-cutout">EDITORIAL CUTOUT</option>
                       <option value="vaporwave">VAPORWAVE RETRO</option>
                       <option value="brutalist">HIGH BRUTALIST</option>
                       <option value="minimal-editorial">MINIMAL EDITORIAL</option>
                       <option value="3d-claymation">3D CLAYMATION</option>
                    </select>
                  </div>

                  <button onClick={() => handleGenerate(false)} disabled={isProcessing} className="w-full bg-pinterest py-6 rounded-3xl font-black text-xs hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-red-900/40 uppercase tracking-[0.2em]">
                     {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Ghost size={18} fill="currentColor"/>}
                     RELEASE THE CHAOS
                  </button>
               </div>
            </div>
         </div>

         <div className="lg:col-span-8 space-y-8">
             {progress && (
               <div className="p-10 bg-pinterest/5 border border-pinterest/20 rounded-[3rem] flex flex-col gap-6 animate-pulse shadow-2xl">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-6">
                      <RefreshCw className="animate-spin text-pinterest" size={32}/>
                      <div>
                        <p className="font-black text-sm text-pinterest uppercase tracking-[0.3em] mb-1">{progress}</p>
                        <p className="text-[11px] text-white/50 font-bold uppercase tracking-widest">{sarcasticTip}</p>
                      </div>
                    </div>
                    <button onClick={() => setShouldStop(true)} className="p-3 bg-white/5 rounded-2xl hover:bg-red-900 transition-colors"><StopCircle size={24}/></button>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-pinterest w-[60%] animate-progress"></div>
                  </div>
               </div>
             )}
             
             {project && (
                <div className="flex flex-col md:flex-row justify-between items-center bg-[#111] p-10 rounded-[3rem] border border-white/10 shadow-2xl gap-8">
                   <div className="flex items-center gap-6">
                     <div className="w-20 h-20 bg-pinterest rounded-[2rem] flex items-center justify-center font-black text-3xl shadow-2xl shadow-red-900/40">{project.pins.length}</div>
                     <div>
                        <p className="font-black text-2xl uppercase tracking-tighter text-white/90">{project.name}</p>
                        <p className="text-[10px] text-pinterest font-black uppercase tracking-[0.4em]">Autonomous Batch Ready</p>
                     </div>
                   </div>
                   <div className="flex flex-wrap gap-4 w-full md:w-auto">
                      <button onClick={handleExportCSV} className="flex-1 md:flex-none bg-white/5 px-8 py-5 rounded-2xl text-xs font-black border border-white/10 uppercase tracking-[0.1em] flex items-center justify-center gap-3 hover:bg-white/10 transition-all">
                          <FileText size={18} /> EXPORT BULK CSV
                      </button>
                      <button onClick={handleExportZip} className="flex-1 md:flex-none bg-[#222] px-8 py-5 rounded-2xl text-xs font-black border border-white/10 uppercase tracking-[0.1em] flex items-center justify-center gap-3 hover:bg-[#333] transition-all">
                          <Package size={18} /> DOWNLOAD ZIP
                      </button>
                      <button onClick={() => setShowPublishModal(true)} disabled={!pinterestUser || project.pins.length === 0} className="flex-1 md:flex-none bg-pinterest px-12 py-5 rounded-2xl text-xs font-black shadow-2xl hover:scale-105 transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                        <Send size={18}/> SYNC CLOUD
                      </button>
                   </div>
                </div>
             )}

             <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pb-32">
                 {project?.pins.map(pin => (
                     <div key={pin.id} className="flex flex-col items-center group/pin">
                         <div ref={el => pinRefs.current[pin.id] = el} className="p-0 bg-transparent rounded-[3rem] overflow-hidden shadow-[0_80px_100px_-40px_rgba(0,0,0,1)] transition-all duration-500 group-hover/pin:scale-[1.02] relative">
                             <PinCanvas pin={pin} showControls={true} />
                             
                             {pin.viralExpert && (
                               <div className="absolute bottom-6 left-6 right-6 bg-black/90 backdrop-blur-3xl p-5 rounded-3xl border border-white/10 opacity-0 group-hover/pin:opacity-100 transition-all translate-y-4 group-hover/pin:translate-y-0 z-[60]">
                                  <div className="flex items-center justify-between mb-2">
                                     <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Savage Audit</span>
                                     <span className="text-xs font-black text-pinterest">{pin.viralExpert.viralScore}% VIRAL</span>
                                  </div>
                                  <p className="text-[10px] text-white/90 font-bold italic mb-4 leading-tight">"{pin.viralExpert.critique}"</p>
                                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-pinterest font-black uppercase mb-1">Expert Fix</p>
                                    <p className="text-[10px] text-white font-bold leading-tight">"{pin.viralExpert.hookImprovement}"</p>
                                  </div>
                               </div>
                             )}

                             {pin.status === 'completed' && !pin.videoUrl && (
                               <div className="absolute top-6 left-6 opacity-0 group-hover/pin:opacity-100 transition-all z-[70]">
                                 <button onClick={(e) => { e.stopPropagation(); handleGenerateVideo(pin.id); }} className="bg-pinterest p-4 rounded-2xl hover:scale-110 transition-all text-white shadow-2xl flex items-center gap-2">
                                   {publishingStatus[pin.id] === 'generating_video' ? <Loader2 className="animate-spin" size={20}/> : <Film size={20}/>}
                                   <span className="text-[10px] font-black uppercase">Viral Motion</span>
                                 </button>
                               </div>
                             )}
                         </div>
                         <div className="mt-8 text-center space-y-4">
                            <div className="flex gap-2 justify-center">
                              <span className="text-[10px] font-black text-pinterest uppercase px-3 py-1 bg-pinterest/10 rounded-full border border-pinterest/20">{pin.targetKeyword}</span>
                              <span className="text-[10px] font-black text-white/40 uppercase px-3 py-1 bg-white/5 rounded-full">{pin.marketingAngle}</span>
                            </div>
                            <h4 className="font-black text-xl leading-none text-white/90 px-4 uppercase tracking-tighter max-w-[300px]">{pin.headline}</h4>
                            
                            {publishingStatus[pin.id] && (
                               <div className="pt-2 flex flex-wrap gap-2 justify-center">
                                  <span className={`text-[10px] font-black uppercase px-6 py-2 rounded-full flex items-center gap-2 ${
                                    publishingStatus[pin.id] === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                                  }`}>
                                     {publishingStatus[pin.id] === 'success' && <Check size={14}/>}
                                     {publishingStatus[pin.id].replace('_', ' ')}
                                  </span>
                               </div>
                            )}
                         </div>
                     </div>
                 ))}
                 
                 {!project && !isProcessing && (
                   <div className="col-span-full py-64 border-2 border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center text-white/20 bg-white/2 flex-1">
                      <Ghost size={80} className="mb-8 opacity-10 animate-bounce"/>
                      <p className="font-black text-4xl uppercase tracking-tighter mb-2 text-white/10">The engine is hungry</p>
                      <p className="text-[12px] font-bold uppercase tracking-[0.4em] text-white/5">Awaiting unhinged parameters</p>
                   </div>
                 )}
             </div>
         </div>
      </main>

      {/* Cloud Configuration Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl flex items-center justify-center p-6 z-[200]">
           <div className="bg-[#111] p-12 rounded-[4rem] max-w-sm w-full border border-white/10 text-center relative shadow-[0_0_100px_rgba(230,0,35,0.1)]">
              <button onClick={() => setShowApiModal(false)} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors"><X/></button>
              <Coffee className="text-pinterest mx-auto mb-8" size={40} />
              <h3 className="text-2xl font-black mb-4 uppercase tracking-tighter">Pinterest Bridge</h3>
              <p className="text-[10px] text-white/40 font-bold mb-8 uppercase tracking-widest leading-relaxed">Pinterest likes to make this difficult. Ensure your Redirect URI is perfectly synced.</p>
              
              <div className="space-y-4 mb-10 text-left">
                <div>
                  <label className="text-[9px] font-black text-white/20 uppercase mb-2 block">App ID</label>
                  <input type="text" value={appId} onChange={e => setAppId(e.target.value)} className="w-full bg-black border border-white/10 p-4 rounded-2xl text-xs font-mono outline-none focus:ring-1 focus:ring-pinterest" placeholder="PINTEREST_APP_ID" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-white/20 uppercase mb-2 block">App Secret</label>
                  <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} className="w-full bg-black border border-white/10 p-4 rounded-2xl text-xs font-mono outline-none focus:ring-1 focus:ring-pinterest" placeholder="SECRET_KEY" />
                </div>
              </div>
              <button onClick={() => { 
                const oauthUrl = getOAuthUrl(appId, redirectUri);
                window.open(oauthUrl, 'PinterestAuth', 'width=600,height=750');
                setShowApiModal(false);
              }} className="w-full bg-pinterest py-6 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-105 transition-all">ESTABLISH CONNECTION</button>
           </div>
        </div>
      )}

      {/* Board Selector Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 z-[200]">
           <div className="bg-[#111] p-12 rounded-[4rem] max-w-md w-full border border-white/10 relative shadow-2xl">
              <button onClick={() => setShowPublishModal(false)} className="absolute top-8 right-8 text-white/20 hover:text-white"><X/></button>
              <h3 className="text-3xl font-black mb-10 flex items-center gap-4 uppercase tracking-tighter"><Send className="text-pinterest" /> Destination</h3>
              <div className="space-y-6">
                 <label className="text-[10px] uppercase font-bold text-white/20 block tracking-[0.3em]">Target Board</label>
                 <select className="w-full bg-black border border-white/10 p-5 rounded-3xl text-sm font-black outline-none mb-10 appearance-none uppercase tracking-widest cursor-pointer hover:border-pinterest/40 transition-all" value={selectedBoard} onChange={e => setSelectedBoard(e.target.value)}>
                    {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                 </select>
                 <button onClick={async () => { 
                   setShowPublishModal(false);
                   setIsProcessing(true);
                   for (const pin of project!.pins.filter(p => p.status === 'completed')) {
                     setPublishingStatus(prev => ({ ...prev, [pin.id]: 'uploading...' }));
                     const res = await publishPin(pinterestToken!, selectedBoard, pin, input.destinationUrl);
                     setPublishingStatus(prev => ({ ...prev, [pin.id]: res.success ? 'success' : 'failed' }));
                   }
                   setIsProcessing(false);
                 }} className="w-full bg-pinterest py-6 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-105 transition-all">EXECUTE CLOUD SYNC</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
