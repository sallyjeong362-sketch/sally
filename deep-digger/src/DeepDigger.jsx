import { useState, useRef, useEffect, useCallback } from "react";
import { callClaude } from "./lib/callClaude";

const LC = {
  ko: { code:"ko", flag:"🇰🇷", label:"한국어", desc:"한국어 질문 + 영어 지문",
    title:"⛏️ 딥 디거", sub:"하나의 주제를 레벨 5까지 끝까지 파봐.\n깊이 팔수록 생각이 깊어져.",
    nameLbl:"이름", namePh:"이름을 입력해줘", pickLbl:"오늘 파고들 주제 하나를 골라봐",
    startBtn:t=>t+" 파고들기 시작 ⛏️", warn:"이름을 입력하고, 주제를 선택해줘!",
    back:"← 처음으로", passLbl:"📖 영어 지문", vocShow:n=>"핵심 어휘 ("+n+"개) ▼",
    vocHide:"어휘 닫기 ▲", hintLbl:"💡 힌트", thinkLbl:"생각해봐!",
    inHint:lv=>lv<4?"✍️ 자유롭게 써봐 — 답하면 다음 레벨로":"✍️ 마지막! 나만의 질문을 만들어봐",
    nextBtn:"더 깊이\n파기 ⛏️", doneBtn:"완성! 🔥",
    loadMsg:(ic,l)=>ic+" "+l+" 생성 중...", retryBtn:"다시 생성하기 ↺",
    errTitle:"생성 실패", rateMsg:"☕ AI가 잠깐 쉬는 중. 잠시 후 다시 해봐요!",
    myAns:n=>"📝 나의 탐구 기록 ("+n+"개)", vocTot:n=>"📚 배운 어휘 ("+n+"개)",
    nextTopic:"다음에 파볼 주제 추천", mission:"✍️ 영어 글쓰기 미션",
    restartBtn:"새로운 주제 파러 가기 →",
    qLang:"Korean", trLang:"Korean", showTr:true, sumLang:"Korean" },
  en: { code:"en", flag:"🇺🇸", label:"English", desc:"Full English immersion",
    title:"⛏️ Deep Digger", sub:"Dig into one topic all the way to level 5.\nThe deeper you dig, the more you discover.",
    nameLbl:"Your name", namePh:"Enter your name", pickLbl:"Pick one topic to dig into today",
    startBtn:t=>"Start digging \""+t+"\" ⛏️", warn:"Please enter your name and pick a topic!",
    back:"← Back", passLbl:"📖 Passage", vocShow:n=>"Key vocabulary ("+n+") ▼",
    vocHide:"Hide vocabulary ▲", hintLbl:"💡 Hint", thinkLbl:"Think about it!",
    inHint:lv=>lv<4?"✍️ Write freely — answer moves you to next level":"✍️ Final level! Create your own question",
    nextBtn:"Dig\nDeeper ⛏️", doneBtn:"Done! 🔥",
    loadMsg:(ic,l)=>ic+" Generating level \""+l+"\"...", retryBtn:"Try again ↺",
    errTitle:"Generation failed", rateMsg:"☕ AI is resting. Try again in a moment!",
    myAns:n=>"📝 My answers ("+n+")", vocTot:n=>"📚 Vocabulary learned ("+n+")",
    nextTopic:"Next topic suggestion", mission:"✍️ Writing Mission",
    restartBtn:"Start a new topic →",
    qLang:"English", trLang:"English", showTr:false, sumLang:"English" },
  mix: { code:"mix", flag:"🌐", label:"Mix", desc:"영어로 읽고 한국어로 생각하기",
    title:"⛏️ Deep Digger", sub:"Read in English, think in Korean.\n영어 지문 + 한국어 질문으로 깊이 파봐.",
    nameLbl:"이름 / Name", namePh:"이름 or Name", pickLbl:"파고들 주제를 골라봐 / Pick your topic",
    startBtn:t=>"\""+t+"\" 파고들기 ⛏️", warn:"이름과 주제를 입력해줘!",
    back:"← Back", passLbl:"📖 English Passage", vocShow:n=>"어휘 / Vocabulary ("+n+") ▼",
    vocHide:"닫기 / Hide ▲", hintLbl:"💡 Hint", thinkLbl:"Think! 생각해봐!",
    inHint:lv=>lv<4?"✍️ 한국어 또는 영어로 자유롭게":"✍️ 나만의 질문 / Your own question 🔥",
    nextBtn:"Next ⛏️", doneBtn:"Done! 🔥",
    loadMsg:(ic,l)=>ic+" \""+l+"\" 생성 중...", retryBtn:"다시 시도 ↺",
    errTitle:"생성 실패 / Failed", rateMsg:"☕ AI가 잠깐 쉬는 중 / AI is resting!",
    myAns:n=>"📝 My answers ("+n+")", vocTot:n=>"📚 Vocabulary ("+n+")",
    nextTopic:"다음 주제 / Next topic", mission:"✍️ Writing Mission",
    restartBtn:"새 주제 / New topic →",
    qLang:"Korean", trLang:"Korean", showTr:true, sumLang:"Korean and English" }
};

const CATS = {
  ko:[
    {name:"IT·AI",emoji:"💻",color:"#378ADD",bg:"#E6F1FB",tags:["ChatGPT·AI","코딩·개발","자율주행","메타버스","사이버보안","블록체인","드론·로봇","반도체"]},
    {name:"과학·우주",emoji:"🔭",color:"#534AB7",bg:"#EEEDFE",tags:["우주탐사·NASA","블랙홀","양자역학","뇌과학","유전자편집","기후변화","진화론","핵융합"]},
    {name:"음악·예술",emoji:"🎵",color:"#D4537E",bg:"#FBEAF0",tags:["작곡·프로듀싱","재즈·클래식","K-pop 산업","영화음악","스트리트아트","건축미학","웹툰·만화","게임아트"]},
    {name:"스포츠·몸",emoji:"⚽",color:"#1D9E75",bg:"#E1F5EE",tags:["축구 전술","농구·NBA","운동과학","영양·식이요법","멘탈트레이닝","격투기","익스트림스포츠","e스포츠"]},
    {name:"사회·역사",emoji:"🌍",color:"#BA7517",bg:"#FAEEDA",tags:["세계사 미스터리","경제·자본주의","심리학·행동경제","철학·윤리","미디어·가짜뉴스","인권·사회운동","종교·신화","국제정치"]},
    {name:"자연·생명",emoji:"🌿",color:"#3B6D11",bg:"#EAF3DE",tags:["동물 행동학","해양·심해생물","식물지능","멸종위기종","균류·미생물","생태계","기후과학","고생물학"]},
  ],
  en:[
    {name:"Tech & AI",emoji:"💻",color:"#378ADD",bg:"#E6F1FB",tags:["ChatGPT & AI","Coding","Self-driving cars","Metaverse","Cybersecurity","Blockchain","Drones & Robots","Semiconductors"]},
    {name:"Science & Space",emoji:"🔭",color:"#534AB7",bg:"#EEEDFE",tags:["Space Exploration","Black Holes","Quantum Physics","Neuroscience","Gene Editing","Climate Change","Evolution","Nuclear Fusion"]},
    {name:"Music & Arts",emoji:"🎵",color:"#D4537E",bg:"#FBEAF0",tags:["Songwriting","Jazz & Classical","K-pop Industry","Film Music","Street Art","Architecture","Webtoons","Game Art"]},
    {name:"Sports & Body",emoji:"⚽",color:"#1D9E75",bg:"#E1F5EE",tags:["Soccer Tactics","Basketball & NBA","Sports Science","Nutrition","Mental Training","Martial Arts","Extreme Sports","Esports"]},
    {name:"Society & History",emoji:"🌍",color:"#BA7517",bg:"#FAEEDA",tags:["World History","Economics","Behavioral Psychology","Philosophy","Media & Fake News","Human Rights","Religion & Myth","Geopolitics"]},
    {name:"Nature & Life",emoji:"🌿",color:"#3B6D11",bg:"#EAF3DE",tags:["Animal Behavior","Deep Sea Life","Plant Intelligence","Endangered Species","Fungi & Microbes","Ecosystems","Climate Science","Paleontology"]},
  ],
  mix:[
    {name:"IT·AI / Tech",emoji:"💻",color:"#378ADD",bg:"#E6F1FB",tags:["ChatGPT·AI","Coding·코딩","자율주행","Metaverse","사이버보안","Blockchain","드론·Robots","반도체"]},
    {name:"과학·Space",emoji:"🔭",color:"#534AB7",bg:"#EEEDFE",tags:["Space·우주탐사","Black Holes","양자역학","Neuroscience","유전자편집","Climate Change","진화론","Nuclear Fusion"]},
    {name:"음악·Arts",emoji:"🎵",color:"#D4537E",bg:"#FBEAF0",tags:["작곡·Songwriting","Jazz·Classic","K-pop","Film Music","Street Art","건축미학","Webtoon","Game Art"]},
    {name:"Sports·스포츠",emoji:"⚽",color:"#1D9E75",bg:"#E1F5EE",tags:["축구 Tactics","Basketball·NBA","Sports Science","영양·Nutrition","Mental Training","격투기","Extreme Sports","Esports"]},
    {name:"사회·History",emoji:"🌍",color:"#BA7517",bg:"#FAEEDA",tags:["세계사 Mystery","Economics·경제","심리학","Philosophy·철학","Media·미디어","Human Rights","종교·Myth","국제정치"]},
    {name:"자연·Nature",emoji:"🌿",color:"#3B6D11",bg:"#EAF3DE",tags:["Animal Behavior","해양·Deep Sea","Plant Intelligence","멸종위기종","Fungi·균류","생태계","Climate Science","고생물학"]},
  ]
};

const LEVELS = {
  ko:[{l:"입문",c:"#888",i:"🌱"},{l:"탐색",c:"#378ADD",i:"🔍"},{l:"심화",c:"#534AB7",i:"⚡"},{l:"연결",c:"#D4537E",i:"🕸️"},{l:"창조",c:"#BA7517",i:"🔥"}],
  en:[{l:"Discovery",c:"#888",i:"🌱"},{l:"Exploration",c:"#378ADD",i:"🔍"},{l:"Deep Dive",c:"#534AB7",i:"⚡"},{l:"Connections",c:"#D4537E",i:"🕸️"},{l:"Creation",c:"#BA7517",i:"🔥"}],
  mix:[{l:"입문 Discovery",c:"#888",i:"🌱"},{l:"탐색 Explore",c:"#378ADD",i:"🔍"},{l:"심화 Deep",c:"#534AB7",i:"⚡"},{l:"연결 Connect",c:"#D4537E",i:"🕸️"},{l:"창조 Create",c:"#BA7517",i:"🔥"}]
};

async function genLevel(topic, name, lv, history, lang) {
  const lc = LC[lang];
  const goals=["What is it? Simple introduction","Why and how it works","Key debates and controversies","Connections to the wider world","Create your own original question"];
  const lastA = history.filter(c=>c.type==="user").slice(-1)[0]?.text||"";
  const msg = [
    "Topic: "+topic,
    "Student name: "+name,
    "Level "+String(lv+1)+" of 5: "+goals[lv],
    lastA?"Student previously wrote: "+lastA.slice(0,120):"",
    "",
    "Respond with only a flat JSON object. Start with the open brace character.",
    "Field names and what to put in them:",
    "ep: 2 to 3 English sentences about the topic at level "+String(lv+1)+" depth",
    "tr: "+String(lc.showTr?lc.trLang+" translation of ep":"same as ep"),
    "w1: first English vocabulary word",
    "m1: meaning of w1 in "+lc.qLang,
    "e1: short English example sentence using w1",
    "w2: second English vocabulary word",
    "m2: meaning of w2 in "+lc.qLang,
    "e2: short English example sentence using w2",
    "w3: third English vocabulary word",
    "m3: meaning of w3 in "+lc.qLang,
    "e3: short English example sentence using w3",
    "qk: inquiry question in "+lc.qLang+" for level "+String(lv+1),
    "qe: same question in English",
    "ht: helpful hint in "+lc.qLang
  ].filter(Boolean).join("\n");

  const d = await callClaude("You are an English teacher. Output only a flat JSON object. No markdown. No nested arrays. Start with open brace.", msg, 600);
  const g = d._g || (k=>d[k]||"");
  const vocab = [
    (d.w1||g("w1"))?{word:d.w1||g("w1"),meaning:d.m1||g("m1"),example:d.e1||g("e1")}:null,
    (d.w2||g("w2"))?{word:d.w2||g("w2"),meaning:d.m2||g("m2"),example:d.e2||g("e2")}:null,
    (d.w3||g("w3"))?{word:d.w3||g("w3"),meaning:d.m3||g("m3"),example:d.e3||g("e3")}:null,
  ].filter(Boolean);
  const ep = d.ep||g("ep"); const qk = d.qk||g("qk");
  if (!ep||!qk) throw new Error("Missing fields");
  return {ep, tr:d.tr||g("tr"), vocab, qk, qe:d.qe||g("qe"), ht:d.ht||g("ht")};
}

async function genSummary(name, topic, qa, lang) {
  const lc = LC[lang];
  const msg = [
    "Student: "+name,
    "Topic: "+topic,
    "Conversation summary:",
    qa.slice(0,400),
    "",
    "Respond with only a flat JSON object. Start with open brace.",
    "Field names:",
    "title: short exploration title in "+lc.sumLang,
    "growth: 2 sentences praising the student thinking in "+lc.sumLang,
    "insight: one key insight discovered in "+lc.sumLang,
    "next: suggested next topic in "+lc.sumLang,
    "challenge: specific English writing challenge in "+lc.sumLang
  ].join("\n");
  return callClaude("You are an English teacher. Output only a flat JSON object. No markdown. Start with open brace.", msg, 600);
}

const Spin=()=>(<span style={{display:"inline-block",width:13,height:13,border:"2px solid #ddd",borderTopColor:"#534AB7",borderRadius:"50%",animation:"spin .7s linear infinite",verticalAlign:"middle",marginRight:6}}/>);
const Card=({children,style})=>(<div style={{border:"0.5px solid #e5e5e5",borderRadius:12,padding:"1.25rem",marginBottom:"1rem",...style}}>{children}</div>);

function LangPicker({onPick}) {
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1rem"}}>
      <div style={{fontSize:52,marginBottom:12}}>⛏️</div>
      <h1 style={{fontSize:24,fontWeight:600,marginBottom:6,textAlign:"center"}}>Deep Digger</h1>
      <p style={{fontSize:14,color:"#888",marginBottom:"2rem",textAlign:"center",lineHeight:1.6}}>언어를 선택해줘 / Choose your language</p>
      <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:320}}>
        {Object.values(LC).map(lc=>(
          <button key={lc.code} onClick={()=>onPick(lc.code)} style={{padding:"16px 20px",borderRadius:14,border:"1.5px solid #e5e5e5",background:"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:28}}>{lc.flag}</span>
            <div><p style={{fontSize:15,fontWeight:600,margin:0,color:"#333"}}>{lc.label}</p><p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>{lc.desc}</p></div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Meter({level,lang}) {
  const lvs=LEVELS[lang];
  return (
    <div style={{marginBottom:"1.5rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:13,fontWeight:500,color:"#555"}}>{lvs[level].i} 레벨 {level+1} — {lvs[level].l}</span>
        <span style={{fontSize:12,color:"#aaa"}}>{level+1}/5</span>
      </div>
      <div style={{display:"flex",gap:4}}>
        {lvs.map((l,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{width:"100%",height:6,borderRadius:99,transition:"background .4s",background:i<=level?l.c:"#f0f0f0"}}/>
            <span style={{fontSize:9,color:i<=level?l.c:"#ccc"}}>{l.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPick({lang,onDone,onChangeLang}) {
  const lc=LC[lang]; const cats=CATS[lang];
  const [name,setName]=useState(""); const [sel,setSel]=useState(null); const [warn,setWarn]=useState(false);
  const run=()=>{ if(!name.trim()||!sel){setWarn(true);return;} onDone({name:name.trim(),topic:sel.tag,cat:sel.cat,lang}); };
  return (
    <div style={{paddingBottom:"2rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.5rem"}}>
        <div><h1 style={{fontSize:22,fontWeight:600,marginBottom:4}}>{lc.title}</h1><p style={{fontSize:13,color:"#888",lineHeight:1.6,whiteSpace:"pre-line"}}>{lc.sub}</p></div>
        <button onClick={onChangeLang} style={{fontSize:20,padding:"4px 8px",borderRadius:8,border:"1px solid #e5e5e5",background:"#fff",cursor:"pointer",flexShrink:0,marginLeft:8}}>{lc.flag}</button>
      </div>
      <div style={{marginBottom:"1.25rem"}}>
        <label style={{fontSize:13,color:"#888",display:"block",marginBottom:6}}>{lc.nameLbl}</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder={lc.namePh} style={{width:"100%",maxWidth:280}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <p style={{fontSize:13,fontWeight:500,color:"#555"}}>{lc.pickLbl}</p>
        {sel&&<span style={{fontSize:12,padding:"3px 10px",borderRadius:99,background:sel.cat.bg,color:sel.cat.color,fontWeight:500}}>✓ {sel.tag}</span>}
      </div>
      {cats.map((cat,ci)=>(
        <div key={ci} style={{marginBottom:"1.25rem"}}>
          <p style={{fontSize:13,fontWeight:500,color:cat.color,marginBottom:7}}>{cat.emoji} {cat.name}</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {cat.tags.map((tag,ti)=>{
              const on=sel?.cat===cat&&sel?.tag===tag;
              return <button key={ti} onClick={()=>setSel({cat,tag})} style={{fontSize:12,padding:"5px 12px",borderRadius:99,cursor:"pointer",border:on?"2px solid "+cat.color:"0.5px solid #ddd",background:on?cat.bg:"#fff",color:on?cat.color:"#666",fontWeight:on?600:400,transition:"all .12s"}}>{tag}</button>;
            })}
          </div>
        </div>
      ))}
      {warn&&<p style={{fontSize:13,color:"#B45309",background:"#FAEEDA",padding:"10px 14px",borderRadius:8,marginBottom:12}}>{lc.warn}</p>}
      <button onClick={run} style={{marginTop:8,padding:"12px 28px",fontSize:14,cursor:"pointer",borderRadius:8,border:"none",background:sel&&name.trim()?"#534AB7":"#ccc",color:"#fff",fontWeight:500}}>{sel&&name.trim()?lc.startBtn(sel.tag):lc.warn}</button>
    </div>
  );
}

function StepDig({session,onRestart}) {
  const {name,topic,cat,lang}=session; const lc=LC[lang]; const lvs=LEVELS[lang];
  const [level,setLevel]=useState(0); const [cards,setCards]=useState([]);
  const [input,setInput]=useState(""); const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false); const [vocOpen,setVocOpen]=useState(null);
  const bottomRef=useRef(null); const loadRef=useRef(false);

  const loadLv=useCallback(async(lv,hist,replIdx)=>{
    if(loadRef.current&&replIdx===undefined)return;
    loadRef.current=true; setLoading(true);
    let data=null,err="";
    for(let i=0;i<3;i++){try{data=await genLevel(topic,name,lv,hist,lang);break;}catch(e){err=e.message;}}
    const card=data?{type:"ai",level:lv,...data}:{type:"ai",level:lv,error:true,errorMsg:err};
    if(replIdx!==undefined) setCards(p=>p.map((c,i)=>i===replIdx?card:c));
    else setCards(p=>[...p,card]);
    setLoading(false); loadRef.current=false;
  },[topic,name,lang]);

  useEffect(()=>{loadLv(0,[]);},[loadLv]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[cards,loading]);

  const submit=async()=>{
    if(!input.trim()||loading)return;
    const uc={type:"user",text:input.trim(),level}; const nc=[...cards,uc];
    setCards(nc); setInput("");
    if(level>=4){setDone(true);return;}
    const next=level+1; setLevel(next); await loadLv(next,nc);
  };

  const curAI=[...cards].reverse().find(c=>c.type==="ai"&&!c.error);
  if(done) return <DoneScreen name={name} topic={topic} cat={cat} lang={lang} cards={cards} onRestart={onRestart}/>;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1rem"}}>
        <button onClick={onRestart} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:"0.5px solid #ccc",background:"#fff",cursor:"pointer"}}>{lc.back}</button>
        <span style={{fontSize:15,fontWeight:500}}>{cat.emoji} {topic}</span>
        <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:cat.bg,color:cat.color}}>{lc.flag}</span>
      </div>
      <Meter level={level} lang={lang}/>
      {cards.map((card,i)=>{
        if(card.type==="user") return (
          <div key={i} style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <div style={{maxWidth:"80%",background:cat.color,color:"#fff",borderRadius:"12px 12px 2px 12px",padding:"10px 14px",fontSize:14,lineHeight:1.6}}>{card.text}</div>
          </div>
        );
        const li=lvs[card.level];
        if(card.error){
          const isR=card.errorMsg&&card.errorMsg.includes("RATE_LIMIT");
          return (
            <div key={i} style={{background:isR?"#fff9e6":"#fff5f5",border:"1px solid "+(isR?"#fcd34d":"#fca5a5"),borderRadius:12,padding:"1rem",marginBottom:14}}>
              <p style={{fontSize:14,color:isR?"#92400e":"#c00",marginBottom:8}}>{isR?lc.rateMsg:lc.errTitle}</p>
              {!isR&&<p style={{fontSize:11,color:"#888",fontFamily:"monospace",wordBreak:"break-all",background:"#f5f5f5",padding:"6px 8px",borderRadius:6,marginBottom:8}}>{card.errorMsg}</p>}
              <button onClick={()=>loadLv(card.level,cards.slice(0,i),i)} style={{fontSize:13,padding:"6px 14px",borderRadius:8,border:"none",background:isR?"#D97706":"#534AB7",color:"#fff",cursor:"pointer"}}>{lc.retryBtn}</button>
            </div>
          );
        }
        return (
          <div key={i} style={{marginBottom:16}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:li.c+"22",borderRadius:99,padding:"2px 10px",marginBottom:8}}>
              <span style={{fontSize:11,color:li.c,fontWeight:500}}>{li.i} {li.l} · Lv.{card.level+1}</span>
            </div>
            <Card style={{background:"#fafafa"}}>
              <p style={{fontSize:12,color:cat.color,fontWeight:600,marginBottom:8}}>{lc.passLbl}</p>
              <p style={{fontSize:14,lineHeight:1.9,color:"#333",fontFamily:"Georgia,serif",marginBottom:lc.showTr?10:0}}>{card.ep}</p>
              {lc.showTr&&card.tr&&<p style={{fontSize:13,color:"#666",lineHeight:1.7,borderTop:"0.5px solid #eee",paddingTop:8}}>{card.tr}</p>}
              {card.vocab&&card.vocab.length>0&&(
                <div style={{marginTop:10}}>
                  <button onClick={()=>setVocOpen(vocOpen===i?null:i)} style={{fontSize:12,padding:"4px 12px",borderRadius:99,border:"0.5px solid #ddd",background:"#fff",cursor:"pointer",color:"#534AB7"}}>
                    {vocOpen===i?lc.vocHide:lc.vocShow(card.vocab.length)}
                  </button>
                  {vocOpen===i&&(
                    <div style={{marginTop:8}}>
                      {card.vocab.map((v,j)=>(
                        <div key={j} style={{padding:"8px 0",borderBottom:j<card.vocab.length-1?"0.5px solid #f0f0f0":"none"}}>
                          <div style={{display:"flex",gap:8,alignItems:"baseline"}}>
                            <span style={{fontSize:14,fontWeight:500,color:cat.color}}>{v.word}</span>
                            <span style={{fontSize:13,color:"#555"}}>{v.meaning}</span>
                          </div>
                          {v.example&&<p style={{fontSize:12,color:"#888",marginTop:3,fontStyle:"italic"}}>{v.example}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
            {card.qk&&(
              <Card style={{borderLeft:"3px solid "+li.c,borderRadius:"0 12px 12px 0"}}>
                <p style={{fontSize:12,color:li.c,fontWeight:500,marginBottom:8}}>{li.i} {lc.thinkLbl}</p>
                <p style={{fontSize:15,lineHeight:1.7,marginBottom:lang!=="en"?8:0}}>{card.qk}</p>
                {lang!=="en"&&card.qe&&<p style={{fontSize:13,color:"#888",fontStyle:"italic",marginBottom:8}}>{card.qe}</p>}
                {card.ht&&(
                  <details style={{marginTop:4}}>
                    <summary style={{fontSize:12,color:"#aaa",cursor:"pointer"}}>{lc.hintLbl}</summary>
                    <p style={{fontSize:13,color:"#666",marginTop:6,lineHeight:1.6}}>{card.ht}</p>
                  </details>
                )}
              </Card>
            )}
          </div>
        );
      })}
      {loading&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"1rem",color:"#888",fontSize:13}}><Spin/>{lc.loadMsg(lvs[level].i,lvs[level].l)}</div>}
      <div ref={bottomRef}/>
      {!loading&&curAI&&(
        <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"0.5px solid #eee",paddingTop:12,marginTop:8}}>
          <div style={{fontSize:12,color:"#aaa",marginBottom:6}}>{lc.inHint(level)}</div>
          <div style={{display:"flex",gap:8}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&e.ctrlKey)submit();}} rows={3} placeholder={lang==="en"?"Type freely...":"한국어 또는 영어로 자유롭게..."} style={{flex:1,resize:"none",fontSize:14}}/>
            <button onClick={submit} disabled={!input.trim()} style={{padding:"0 16px",borderRadius:8,border:"none",background:input.trim()?"#534AB7":"#ddd",color:"#fff",cursor:input.trim()?"pointer":"default",fontSize:13,fontWeight:500,whiteSpace:"pre",alignSelf:"stretch"}}>{level<4?lc.nextBtn:lc.doneBtn}</button>
          </div>
          <p style={{fontSize:11,color:"#ccc",marginTop:4}}>Ctrl+Enter</p>
        </div>
      )}
    </div>
  );
}

function DoneScreen({name,topic,cat,lang,cards,onRestart}) {
  const lc=LC[lang]; const lvs=LEVELS[lang];
  const [sum,setSum]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const qa=cards.map(c=>c.type==="ai"?"Q(Lv"+(c.level+1)+"): "+(c.qk||""):"A: "+c.text).join("\n");
    genSummary(name,topic,qa,lang).then(d=>setSum(d)).catch(()=>setSum(null)).finally(()=>setLoading(false));
  },[]);
  const uAns=cards.filter(c=>c.type==="user");
  const vocab=cards.filter(c=>c.type==="ai").flatMap(c=>c.vocab||[]);
  return (
    <div>
      <div style={{textAlign:"center",padding:"2rem 0 1.5rem"}}>
        <div style={{fontSize:48,marginBottom:12}}>🏆</div>
        <h2 style={{fontSize:20,fontWeight:500,marginBottom:4}}>{lang==="en"?"Level 5 Complete!":"레벨 5 달성!"}</h2>
        <p style={{fontSize:14,color:"#888"}}><span style={{background:cat.bg,color:cat.color,padding:"2px 10px",borderRadius:99,fontWeight:500}}>{cat.emoji} {topic}</span></p>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:"1.5rem"}}>
        {lvs.map((l,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{width:"100%",height:8,borderRadius:99,background:l.c}}/>
            <span style={{fontSize:9,color:l.c,fontWeight:500}}>{l.i}</span>
          </div>
        ))}
      </div>
      {loading?(<Card style={{textAlign:"center",padding:"2rem"}}><Spin/><span style={{fontSize:14,color:"#888"}}>{lang==="en"?"Generating report...":"리포트 생성 중..."}</span></Card>)
      :sum&&(
        <>
          <Card style={{background:cat.bg,borderColor:cat.color}}>
            <p style={{fontSize:16,fontWeight:500,color:cat.color,marginBottom:8}}>{sum.title}</p>
            <p style={{fontSize:14,lineHeight:1.7,marginBottom:10}}>{sum.growth}</p>
            {sum.insight&&(<div style={{background:"#fff",borderRadius:8,padding:"10px 14px",borderLeft:"3px solid "+cat.color}}><p style={{fontSize:13,color:"#666"}}>💡 {lang==="en"?"Key Insight":"핵심 통찰"}</p><p style={{fontSize:14,color:"#333",marginTop:4,lineHeight:1.6}}>{sum.insight}</p></div>)}
          </Card>
          <Card>
            <p style={{fontSize:13,fontWeight:500,color:"#888",marginBottom:12}}>{lc.myAns(uAns.length)}</p>
            {uAns.map((c,i)=>(
              <div key={i} style={{display:"flex",gap:10,marginBottom:10,paddingBottom:10,borderBottom:i<uAns.length-1?"0.5px solid #f0f0f0":"none"}}>
                <span style={{fontSize:11,color:lvs[c.level]?.c,fontWeight:500,flexShrink:0,marginTop:2}}>{lvs[c.level]?.i} Lv{c.level+1}</span>
                <p style={{fontSize:13,color:"#444",lineHeight:1.6}}>{c.text}</p>
              </div>
            ))}
          </Card>
          {vocab.length>0&&(<Card><p style={{fontSize:13,fontWeight:500,color:"#888",marginBottom:12}}>{lc.vocTot(vocab.length)}</p><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{vocab.map((v,i)=>(<span key={i} title={v.meaning} style={{fontSize:12,padding:"4px 10px",borderRadius:99,background:cat.bg,color:cat.color}}>{v.word}</span>))}</div></Card>)}
          {sum.challenge&&(
            <Card style={{borderLeft:"3px solid #534AB7",borderRadius:"0 12px 12px 0"}}>
              <p style={{fontSize:13,color:"#534AB7",fontWeight:500,marginBottom:8}}>{lc.mission}</p>
              <p style={{fontSize:14,color:"#333",lineHeight:1.7,marginBottom:12}}>{sum.challenge}</p>
              {sum.next&&(<div style={{background:"#f7f7ff",borderRadius:8,padding:"10px 14px"}}><p style={{fontSize:12,color:"#888"}}>{lc.nextTopic}</p><p style={{fontSize:14,color:"#534AB7",fontWeight:500,marginTop:4}}>⛏️ {sum.next}</p></div>)}
            </Card>
          )}
        </>
      )}
      <button onClick={onRestart} style={{width:"100%",padding:"12px",fontSize:14,cursor:"pointer",borderRadius:10,border:"none",background:"#534AB7",color:"#fff",fontWeight:500,marginTop:8}}>{lc.restartBtn}</button>
    </div>
  );
}

export default function DeepDigger() {
  const [lang,setLang]=useState(null); const [session,setSession]=useState(null);
  return (
    <>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{maxWidth:620,margin:"0 auto",padding:"1.5rem 1rem",fontFamily:"var(--font-sans,-apple-system,sans-serif)"}}>
        {!lang?<LangPicker onPick={l=>setLang(l)}/>
        :!session?<StepPick lang={lang} onDone={s=>setSession(s)} onChangeLang={()=>{setLang(null);setSession(null);}}/>
        :<StepDig session={session} onRestart={()=>setSession(null)}/>}
      </div>
    </>
  );
}
