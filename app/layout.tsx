import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fitness Heim System",
  description: "Buchung des Fitnessraums im St. Georg Schülerheim",
};

// Gespeicherte Ansicht und Farbe setzen, bevor die Seite gezeichnet wird (kein Aufblitzen)
const themeScript = `(function(){try{
var t=(location.pathname==='/'||localStorage.getItem('heim.theme')!=='light')?'dark':'light';
var a=localStorage.getItem('heim.accent');
if(!/^#[0-9a-fA-F]{6}$/.test(a||''))a='#deff9a';
var l=localStorage.getItem('heim.language')==='it'?'it':'de';
var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;r.lang=l;
var n=a.slice(1),p=[0,2,4].map(function(i){return parseInt(n.slice(i,i+2),16)/255;});
var ch=function(v){return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
var lum=0.2126*ch(p[0])+0.7152*ch(p[1])+0.0722*ch(p[2]);
var text=a;
if(t==='light'&&lum>0.35){var mix=lum>0.6?0.55:0.35;
text='#'+[0,2,4].map(function(i){return Math.round(parseInt(n.slice(i,i+2),16)*(1-mix)).toString(16).padStart(2,'0');}).join('');}
r.style.setProperty('--accent',a);r.style.setProperty('--accent-text',text);
r.style.setProperty('--accent-contrast',lum>0.45?'#000000':'#ffffff');
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
