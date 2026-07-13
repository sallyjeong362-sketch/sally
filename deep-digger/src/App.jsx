import { useState } from "react";
import DeepDigger from "./DeepDigger";
import DeepDiggerKids from "./DeepDiggerKids";

function getInitialMode() {
  const p = new URLSearchParams(window.location.search).get("app");
  if (p === "kids" || p === "main") return p;
  return null;
}

export default function App() {
  const [mode, setMode] = useState(getInitialMode);

  if (mode === "main") return <DeepDigger />;
  if (mode === "kids") return <DeepDiggerKids />;

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",fontFamily:"-apple-system,sans-serif"}}>
      <div style={{fontSize:52,marginBottom:12}}>⛏️</div>
      <h1 style={{fontSize:24,fontWeight:600,marginBottom:6,textAlign:"center"}}>Deep Digger</h1>
      <p style={{fontSize:14,color:"#888",marginBottom:"2rem",textAlign:"center",lineHeight:1.6}}>어떤 버전으로 파고들어볼까?</p>
      <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:320}}>
        <button onClick={()=>setMode("main")} style={{padding:"16px 20px",borderRadius:14,border:"1.5px solid #e5e5e5",background:"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>⛏️</span>
          <div><p style={{fontSize:15,fontWeight:600,margin:0,color:"#333"}}>Deep Digger</p><p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>청소년·성인용 · 레벨 5까지 깊이 파는 영어 탐구</p></div>
        </button>
        <button onClick={()=>setMode("kids")} style={{padding:"16px 20px",borderRadius:14,border:"1.5px solid #e5e5e5",background:"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>🌟</span>
          <div><p style={{fontSize:15,fontWeight:600,margin:0,color:"#333"}}>Deep Digger Kids</p><p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>어린이용 · 게임과 함께 배우는 영어 탐험</p></div>
        </button>
      </div>
    </div>
  );
}
