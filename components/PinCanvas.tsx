
import React, { useMemo, useState } from 'react';
import { GeneratedPin } from '../types';

interface PinCanvasProps {
  pin: GeneratedPin;
  scale?: number;
  onEdit?: () => void;
  showControls?: boolean;
}

const PinCanvas: React.FC<PinCanvasProps> = ({ pin, scale = 1, onEdit, showControls = true }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  
  const fonts = useMemo(() => {
    switch (pin.fontPairing) {
      case 'tech-mono': return { head: 'font-mono font-bold tracking-tighter', body: 'font-mono text-[8px] uppercase' };
      case 'future-heavy': return { head: 'font-sans font-[900] italic uppercase leading-[0.8]', body: 'font-sans text-[9px]' };
      case 'retro-pop': return { head: 'font-display font-black uppercase tracking-tighter', body: 'font-sans font-bold' };
      case 'editorial': return { head: 'font-serif font-bold italic', body: 'font-sans tracking-wide' };
      default: return { head: 'font-sans font-black tracking-tight', body: 'font-sans font-medium' };
    }
  }, [pin.fontPairing]);

  const imperfection = useMemo(() => {
    const level = (pin.imperfectionLevel || 0) / 10;
    const type = pin.imperfectionType || 'none';
    const seed = Math.random();
    
    const rot = (seed - 0.5) * 1.5 * level;
    const shiftX = (Math.random() - 0.5) * 8 * level;
    const shiftY = (Math.random() - 0.5) * 8 * level;

    let overlayUrl = '';
    let filter = 'none';
    let mixBlend = 'normal';
    let overlayOpacity = level * 0.15;

    switch (type) {
      case 'organic':
        overlayUrl = 'https://www.transparenttextures.com/patterns/pinstripe.png';
        filter = `brightness(${1 - level * 0.05}) contrast(${1 + level * 0.05})`;
        mixBlend = 'overlay';
        break;
      case 'gritty':
        overlayUrl = 'https://www.transparenttextures.com/patterns/asfalt-dark.png';
        filter = `contrast(${1 + level * 0.2}) grayscale(${level * 0.2})`;
        mixBlend = 'multiply';
        overlayOpacity = level * 0.3;
        break;
      case 'analog':
        overlayUrl = 'https://www.transparenttextures.com/patterns/film-grain.png';
        filter = `sepia(${level * 0.1}) hue-rotate(${level * 5}deg)`;
        mixBlend = 'screen';
        overlayOpacity = level * 0.4;
        break;
      case 'hand-drawn':
        overlayUrl = 'https://www.transparenttextures.com/patterns/paper.png';
        mixBlend = 'multiply';
        overlayOpacity = level * 0.1;
        break;
      default:
        overlayOpacity = 0;
    }

    return {
      textStyle: {
        transform: `rotate(${rot}deg) translate(${shiftX}px, ${shiftY}px)`,
        filter: type === 'analog' ? `blur(${level * 0.4}px)` : 'none',
        textShadow: level > 0.5 && type === 'analog' 
          ? `${1.5 * level}px 0px 0px rgba(255,0,0,0.5), ${-1.5 * level}px 0px 0px rgba(0,255,255,0.5)` 
          : 'none',
      },
      containerFilter: filter,
      overlayUrl,
      overlayOpacity,
      mixBlend
    };
  }, [pin.imperfectionLevel, pin.imperfectionType]);

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000',
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    filter: imperfection.containerFilter
  };

  const Background = () => (
    <div className="absolute inset-0 bg-dark-900 overflow-hidden">
      {pin.videoUrl ? (
        <video 
          src={pin.videoUrl} 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="w-full h-full object-cover"
        />
      ) : pin.imageUrl ? (
        <img 
          src={pin.imageUrl} 
          alt={pin.headline}
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-700 ease-out ${imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
        />
      ) : (
        <div className="absolute inset-0 shimmer opacity-20"></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80"></div>
      
      {/* Texture Layer */}
      {imperfection.overlayUrl && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            opacity: imperfection.overlayOpacity,
            backgroundImage: `url("${imperfection.overlayUrl}")`,
            backgroundSize: '200px 200px',
            mixBlendMode: imperfection.mixBlend as any
          }}
        />
      )}
    </div>
  );

  const renderLayout = () => {
    switch (pin.layout) {
      case 'magazine-cutout':
        return (
          <div style={containerStyle} className="p-4 bg-zinc-950">
             <div className="w-full h-full border-2 border-white/10 relative overflow-hidden rounded-lg">
                <Background />
                <div className="absolute top-10 left-6 right-6 p-6 bg-white mix-blend-difference" style={imperfection.textStyle}>
                   <h1 className={`${fonts.head} text-4xl text-black leading-[0.75] uppercase tracking-tighter`}>{pin.headline}</h1>
                </div>
                <div className="absolute bottom-10 left-6 right-6">
                   <div className="bg-pinterest text-white inline-block px-5 py-2 font-black text-[14px] uppercase transform -rotate-1 shadow-2xl mb-4">
                      {pin.cta}
                   </div>
                   <p className={`${fonts.body} text-white text-[12px] bg-black/60 p-3 backdrop-blur-md rounded-sm`}>{pin.subheadline}</p>
                </div>
             </div>
          </div>
        );

      case 'abstract-data-viz':
        return (
          <div style={containerStyle} className="bg-black p-8 font-mono">
             <div className="absolute inset-0 opacity-40">
               <Background />
             </div>
             <div className="relative h-full border border-white/10 p-6 flex flex-col justify-between backdrop-blur-xl bg-black/30">
               <div className="space-y-4">
                 <div className="flex justify-between text-[7px] text-white/40 border-b border-white/10 pb-2 uppercase tracking-widest">
                   <span>SYS_PINFLOW_ACTIVE</span>
                   <span>CONFIDENCE: {pin.viralExpert?.viralScore}%</span>
                 </div>
                 <h1 style={imperfection.textStyle} className={`${fonts.head} text-3xl text-white uppercase leading-none drop-shadow-lg`}>{pin.headline}</h1>
                 <p className="text-[10px] text-pinterest font-bold tracking-[0.2em]">{pin.targetKeyword.toUpperCase()}</p>
               </div>
               <div className="space-y-6">
                 <p className="text-[11px] text-white/80 leading-relaxed italic border-l-2 border-pinterest pl-4">{pin.subheadline}</p>
                 <div className="bg-white text-black py-4 text-center font-black text-[11px] tracking-[0.2em] shadow-xl">
                    {pin.cta}
                 </div>
               </div>
             </div>
          </div>
        );

      default:
        return (
          <div style={containerStyle}>
             <Background />
             <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
                <div className="w-16 h-1 bg-pinterest mb-10"></div>
                <h1 style={imperfection.textStyle} className={`${fonts.head} text-4xl text-white mb-6 uppercase leading-[0.85] tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]`}>{pin.headline}</h1>
                <p className={`${fonts.body} text-[15px] text-white/95 mb-12 leading-snug drop-shadow-md max-w-[90%]`}>{pin.subheadline}</p>
                <div className="px-12 py-4 bg-white text-black font-black text-[12px] uppercase shadow-2xl rounded-full hover:bg-pinterest hover:text-white transition-all transform hover:scale-105">
                   {pin.cta}
                </div>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="w-[270px] h-[480px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] overflow-hidden bg-dark-900 flex-shrink-0 relative group rounded-[3rem] border border-white/5">
       {renderLayout()}
       {showControls && (
         <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col gap-4 items-center justify-center z-50 backdrop-blur-xl">
            <button 
              onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(); }} 
              className="bg-white text-black font-black px-12 py-5 rounded-full text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:scale-110 active:scale-95 transition-all"
            >
              Manual Override
            </button>
            <div className="text-[9px] text-white/40 font-mono tracking-[0.3em] uppercase px-4 text-center mt-4 border-t border-white/10 pt-4">
              {pin.imperfectionType?.toUpperCase()}: {pin.imperfectionLevel}/10
            </div>
         </div>
       )}
    </div>
  );
};

export default PinCanvas;
