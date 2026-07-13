import { useState, useRef, useEffect, useCallback } from "react";
import { callClaude } from "./lib/callClaude";

const LC = {
  ko:{code:"ko",flag:"🇰🇷",label:"한국어",desc:"한국어로 탐험해요!",
    title:"오늘 뭐가 궁금해?",sub:"하나 골라봐 — 게임도 하고 영상도 보면서\n영어로 신나게 탐험하자! 🚀",
    nameLbl:"이름이 뭐야? 👋",namePh:"내 이름은...",pickLbl:"오늘 탐험할 것 하나를 골라봐!",
    startBtn:t=>"\""+t+"\" 탐험 시작! 🚀",back:"← 처음으로",warn:"이름이랑 주제를 골라줘! 😊",
    passLbl:"📖 English Time!",vocBtn:n=>"✨ 영어 단어 배우기 ("+n+"개) ▼",vocClose:"단어 닫기 ▲",
    thinkLbl:"생각해봐!",
    inHint:lv=>lv<2?"✏️ 자유롭게 써봐! 답하면 다음 레벨로":"✏️ 마지막! 네 생각을 마음껏 써봐 ⭐",
    nextBtn:"다음\n⬆",doneBtn:"완성\n⭐",loadMsg:ic=>ic+" 만들어 오는 중...",
    retryBtn:"다시 해볼게요 ↺",errMsg:"앗! 문제가 생겼어요 😢",
    rateMsg:"☕ AI 선생님이 잠깐 쉬는 중이에요! 조금 후에 다시 해봐요 🌟",
    doneTitle:"탐험 완료!",doneSub:"3레벨 달성!",praiseTitle:n=>"🌟 "+n+"에게",
    ansLbl:"📝 내가 한 말들",vocTot:"✨ 오늘 배운 영어 단어",mission:"✍️ 오늘의 영어 미션!",
    nextLbl:"다음에 파볼 주제 추천",restart:"새로운 탐험 떠나기! 🚀",
    matchGame:"🎮 단어 매칭 게임 — 영어 단어와 뜻을 연결해봐!",
    fillGame:"🎮 빈칸 채우기 — 알맞은 단어를 넣어봐!",fillHint:w=>"힌트: 영어로 \""+w+"\"",
    checkBtn:"확인!",correctMsg:"🎉 정답이야! 대단해!",wrongMsg:"다시 해봐!",
    myCardGame:"🎨 나만의 탐험 카드를 만들어봐!",cardNameLbl:n=>n+"의 탐험 카드",
    cardSentLbl:"✏️ 오늘 배운 것을 한 문장으로!",cardSentPh:t=>"\""+t+"은/는 _____ 이다!\"",
    feelLbl:"😊 오늘 탐험은 어땠어?",
    feels:["😊 재밌었어","🤩 놀라웠어","🤔 어려웠어","💡 새로 알았어","❤️ 좋아졌어"],
    drawLbl:"🖊️ 그림이나 이모지로 표현해봐 (선택)",drawPh:"이모지나 짧은 글로 표현해봐 🌟",
    cardDoneBtn:"탐험 카드 완성! 🏆",cardComplete:"탐험 카드 완성!",
    ytLbl:"🎬 이런 영상 찾아봐!",ytSub:"YouTube에서 검색하기 →",
    reportLoad:"결과 만드는 중...",
    lvLabels:["🌱 첫 발견!","🔍 왜 그럴까?","⭐ 나만의 생각!"],
    lvDescs:["단어 맞추기 게임","빈칸 채우기 게임","나만의 탐험 카드"],
    qLang:"Korean",trLang:"Korean",showTr:true,sumLang:"Korean"},
  en:{code:"en",flag:"🇺🇸",label:"English",desc:"Full English immersion!",
    title:"What are you curious about?",sub:"Pick one thing — play games, watch videos,\nand explore in English! 🚀",
    nameLbl:"What's your name? 👋",namePh:"My name is...",pickLbl:"Pick ONE thing to explore today!",
    startBtn:t=>"Start exploring \""+t+"\"! 🚀",back:"← Back",warn:"Enter your name and pick a topic! 😊",
    passLbl:"📖 Let's Read!",vocBtn:n=>"✨ Learn English words ("+n+") ▼",vocClose:"Hide words ▲",
    thinkLbl:"Think about it!",
    inHint:lv=>lv<2?"✏️ Write freely! Your answer moves you to the next level":"✏️ Last level! Write your own thoughts ⭐",
    nextBtn:"Next\n⬆",doneBtn:"Done\n⭐",loadMsg:ic=>ic+" Creating your adventure...",
    retryBtn:"Try again ↺",errMsg:"Oops! Something went wrong 😢",
    rateMsg:"☕ AI teacher is taking a short break! Try again soon 🌟",
    doneTitle:"Exploration Complete!",doneSub:"All 3 levels done!",praiseTitle:n=>"🌟 To "+n,
    ansLbl:"📝 What I said",vocTot:"✨ English words learned today",mission:"✍️ Today's English Mission!",
    nextLbl:"Next topic to explore",restart:"Start a new adventure! 🚀",
    matchGame:"🎮 Word Matching Game — Connect the word to its meaning!",
    fillGame:"🎮 Fill in the Blank — Put the right word in!",fillHint:w=>"Hint: the word is \""+w+"\"",
    checkBtn:"Check!",correctMsg:"🎉 Correct! You're amazing!",wrongMsg:"Try again!",
    myCardGame:"🎨 Make your own Explorer Card!",cardNameLbl:n=>n+"'s Explorer Card",
    cardSentLbl:"✏️ Write one sentence about what you learned!",cardSentPh:t=>"\""+t+" is _____ !\"",
    feelLbl:"😊 How was today's exploration?",
    feels:["😊 Fun!","🤩 Amazing!","🤔 Hard!","💡 I learned!","❤️ I love it!"],
    drawLbl:"🖊️ Draw or use emojis! (optional)",drawPh:"Use emojis or words to show! 🌟",
    cardDoneBtn:"Complete my card! 🏆",cardComplete:"Card complete!",
    ytLbl:"🎬 Watch this type of video!",ytSub:"Search on YouTube →",
    reportLoad:"Creating your results...",
    lvLabels:["🌱 First Discovery!","🔍 Why & How?","⭐ My Own Idea!"],
    lvDescs:["Word matching game","Fill in the blank","My explorer card"],
    qLang:"English",trLang:"English",showTr:false,sumLang:"English"},
  mix:{code:"mix",flag:"🌐",label:"Mix",desc:"영어 읽기 + 한국어로 생각하기",
    title:"오늘 뭐가 궁금해? / What's interesting?",sub:"영어로 읽고 한국어로 생각해봐!\nRead English, think in Korean 🚀",
    nameLbl:"이름 / Name 👋",namePh:"이름 or Name",pickLbl:"주제 하나 골라봐 / Pick one topic!",
    startBtn:t=>"\""+t+"\" 탐험! 🚀",back:"← Back / 처음",warn:"이름과 주제를 입력해줘!",
    passLbl:"📖 English Time!",vocBtn:n=>"✨ Words / 단어 ("+n+") ▼",vocClose:"Hide / 닫기 ▲",
    thinkLbl:"Think! 생각해봐!",
    inHint:lv=>lv<2?"✏️ 한국어 또는 영어로 자유롭게!":"✏️ 나만의 생각 / Your own idea ⭐",
    nextBtn:"Next ⬆",doneBtn:"Done ⭐",loadMsg:ic=>ic+" 만드는 중 / Creating...",
    retryBtn:"다시 / Try again ↺",errMsg:"앗! Oops! 😢",
    rateMsg:"☕ AI가 잠깐 쉬는 중 / AI is resting! Try again soon 🌟",
    doneTitle:"탐험 완료! Complete!",doneSub:"3 Levels! 3레벨 달성!",praiseTitle:n=>"🌟 "+n+"에게 / To "+n,
    ansLbl:"📝 My answers / 내가 한 말",vocTot:"✨ Words learned / 배운 단어",
    mission:"✍️ English Mission!",nextLbl:"다음 주제 / Next topic",restart:"새 탐험 / New adventure! 🚀",
    matchGame:"🎮 Word Match / 단어 매칭!",fillGame:"🎮 Fill Blank / 빈칸 채우기!",
    fillHint:w=>"Hint: \""+w+"\"",checkBtn:"Check! 확인!",
    correctMsg:"🎉 Correct! 정답! Amazing!",wrongMsg:"Try again! 다시!",
    myCardGame:"🎨 My Explorer Card / 나만의 탐험 카드!",cardNameLbl:n=>n+"'s Card",
    cardSentLbl:"✏️ 한 문장으로 / One sentence!",cardSentPh:t=>"\""+t+" is / 은 _____ !\"",
    feelLbl:"😊 어땠어? / How was it?",
    feels:["😊 Fun! 재밌어","🤩 Amazing! 놀라워","🤔 Hard! 어려워","💡 Learned! 새로 알았어","❤️ Love it!"],
    drawLbl:"🖊️ 이모지 / Emojis (optional)",drawPh:"이모지 / Emojis 🌟",
    cardDoneBtn:"카드 완성! Card done! 🏆",cardComplete:"Complete! 완성!",
    ytLbl:"🎬 Watch this! 이런 영상 봐봐!",ytSub:"YouTube Search →",
    reportLoad:"결과 만드는 중 / Creating...",
    lvLabels:["🌱 Discovery! 첫 발견!","🔍 Why? 왜 그럴까?","⭐ My Idea! 나만의 생각!"],
    lvDescs:["Word match / 단어 맞추기","Fill blank / 빈칸 채우기","My card / 나만의 카드"],
    qLang:"Korean",trLang:"Korean",showTr:true,sumLang:"Korean"}
};

const CATS_KO=[
  {name:"동물 친구",emoji:"🐾",color:"#1D9E75",bg:"#E1F5EE",tags:["강아지","고양이","공룡","상어","펭귄","코끼리","토끼","나비","사자","돌고래"]},
  {name:"우주·지구",emoji:"🚀",color:"#534AB7",bg:"#EEEDFE",tags:["별과 달","로켓·우주선","공룡시대","화산·지진","무지개","구름·날씨","바다 속","운석·소행성"]},
  {name:"음식·요리",emoji:"🍕",color:"#D4537E",bg:"#FBEAF0",tags:["피자","아이스크림","초콜릿","라면","케이크","과일","빵·쿠키","채소"]},
  {name:"스포츠·놀이",emoji:"⚽",color:"#BA7517",bg:"#FAEEDA",tags:["축구","수영","달리기","댄스","체조","태권도","자전거","줄넘기"]},
  {name:"만들기·예술",emoji:"🎨",color:"#993556",bg:"#FBEAF0",tags:["그림 그리기","색칠하기","찰흙·점토","종이접기","레고·블록","노래·음악","춤추기","사진"]},
  {name:"신기한 과학",emoji:"🔬",color:"#378ADD",bg:"#E6F1FB",tags:["로봇","자석","물과 얼음","씨앗과 식물","빛과 색깔","소리·울림","곤충","화학 실험"]},
  {name:"이야기·판타지",emoji:"🧚",color:"#7F77DD",bg:"#EEEDFE",tags:["마법사·마녀","용·드래곤","슈퍼히어로","인어공주","요정","우주인","시간여행","보물찾기"]},
  {name:"탈것·기계",emoji:"🚗",color:"#3B6D11",bg:"#EAF3DE",tags:["자동차","기차·지하철","비행기","배·잠수함","소방차","헬리콥터","로켓","트랙터"]},
];
const CATS_EN=[
  {name:"Animal Friends",emoji:"🐾",color:"#1D9E75",bg:"#E1F5EE",tags:["Dogs","Cats","Dinosaurs","Sharks","Penguins","Elephants","Rabbits","Butterflies","Lions","Dolphins"]},
  {name:"Space & Earth",emoji:"🚀",color:"#534AB7",bg:"#EEEDFE",tags:["Stars & Moon","Rockets","Dinosaur Age","Volcanoes","Rainbows","Clouds & Weather","Under the Sea","Meteors"]},
  {name:"Food & Cooking",emoji:"🍕",color:"#D4537E",bg:"#FBEAF0",tags:["Pizza","Ice Cream","Chocolate","Noodles","Cake","Fruit","Bread & Cookies","Vegetables"]},
  {name:"Sports & Play",emoji:"⚽",color:"#BA7517",bg:"#FAEEDA",tags:["Soccer","Swimming","Running","Dancing","Gymnastics","Martial Arts","Biking","Jump Rope"]},
  {name:"Art & Making",emoji:"🎨",color:"#993556",bg:"#FBEAF0",tags:["Drawing","Coloring","Clay","Origami","Lego & Blocks","Singing","Dancing","Photos"]},
  {name:"Cool Science",emoji:"🔬",color:"#378ADD",bg:"#E6F1FB",tags:["Robots","Magnets","Water & Ice","Seeds & Plants","Light & Colors","Sound & Echo","Insects","Experiments"]},
  {name:"Fantasy Stories",emoji:"🧚",color:"#7F77DD",bg:"#EEEDFE",tags:["Wizards & Witches","Dragons","Superheroes","Mermaids","Fairies","Aliens","Time Travel","Treasure Hunt"]},
  {name:"Vehicles",emoji:"🚗",color:"#3B6D11",bg:"#EAF3DE",tags:["Cars","Trains","Airplanes","Ships & Submarines","Fire Trucks","Helicopters","Rockets","Tractors"]},
];
const getCats=lang=>lang==="en"?CATS_EN:CATS_KO;
const LV_COLORS=["#1D9E75","#378ADD","#D4537E"];

async function fetchLevel(topic,catName,level,lastAnswer,lang){
  const lc=LC[lang];
  const goals=["Simple introduction for age 5 to 7","Ask why and how for age 6 to 8","Encourage imagination for age 7 to 10"];
  const lines=[
    "Topic: "+topic,
    "Category: "+catName,
    "Level "+String(level+1)+" of 3: "+goals[level],
    lastAnswer?"Child previously said: "+lastAnswer.trim().slice(0,150):"",
    "",
    "Respond with only a flat JSON object. Start with open brace character.",
    "Field names and what to write:",
    "et: two simple A1 English sentences about the topic",
    "tr: "+String(lc.showTr?lc.trLang+" translation of et for children":"same as et"),
    "ff: one fun fact about the topic in "+lc.qLang+", start with an emoji",
    "w1: first English vocabulary word",
    "m1: meaning of w1 in "+lc.qLang,
    "e1: emoji for w1",
    "w2: second English vocabulary word",
    "m2: meaning of w2 in "+lc.qLang,
    "e2: emoji for w2",
    "w3: third English vocabulary word",
    "m3: meaning of w3 in "+lc.qLang,
    "e3: emoji for w3",
    "qk: question for the child in "+lc.qLang,
    "qe: same question in English",
    "ys: 3 English words to search on YouTube for kids videos about this topic",
    "fw: one simple English word from et to use in fill in the blank game"
  ].filter(Boolean);
  const d=await callClaude("You are a children English teacher. Output only a flat JSON object. No markdown. Start with open brace.",lines.join("\n"),500);
  const g=d._g||(k=>d[k]||"");
  const vocab=[
    (d.w1||g("w1"))?{word:d.w1||g("w1"),meaning:d.m1||g("m1"),emoji:d.e1||g("e1")||"📚"}:null,
    (d.w2||g("w2"))?{word:d.w2||g("w2"),meaning:d.m2||g("m2"),emoji:d.e2||g("e2")||"📖"}:null,
    (d.w3||g("w3"))?{word:d.w3||g("w3"),meaning:d.m3||g("m3"),emoji:d.e3||g("e3")||"✏️"}:null,
  ].filter(Boolean);
  const et=d.et||g("et"),qk=d.qk||g("qk");
  if(!et||!qk)throw new Error("Missing fields");
  return{et,tr:d.tr||g("tr"),ff:d.ff||g("ff"),vocab,qk,qe:d.qe||g("qe"),ys:d.ys||g("ys"),fw:d.fw||g("fw")};
}

const Spin=()=>(<span style={{display:"inline-block",width:15,height:15,border:"2.5px solid #f0f0f0",borderTopColor:"#534AB7",borderRadius:"50%",animation:"spin .7s linear infinite",verticalAlign:"middle",marginRight:7}}/>);
const Stars=({n})=>(<span style={{fontSize:18,letterSpacing:2}}>{"⭐".repeat(n)}{"☆".repeat(3-n)}</span>);

function WordMatch({vocab,cat,lc,onClear}){
  const items=vocab.slice(0,3);
  const [matched,setMatched]=useState({});const [sel,setSel]=useState(null);const [wrong,setWrong]=useState(null);const [done,setDone]=useState(false);
  const meanings=[...items.map(v=>v.meaning)].sort(()=>Math.random()-.5);
  const pick=(type,val)=>{
    if(type==="word"){setSel({val});return;}
    if(!sel)return;
    const pair=items.find(v=>v.word===sel.val);
    if(pair&&pair.meaning===val){const nm={...matched,[sel.val]:val};setMatched(nm);setSel(null);if(Object.keys(nm).length===items.length){setDone(true);setTimeout(onClear,1200);}}
    else{setWrong(sel.val);setTimeout(()=>{setWrong(null);setSel(null);},700);}
  };
  return(
    <div style={{marginBottom:12}}>
      <p style={{fontSize:12,color:cat.color,fontWeight:700,marginBottom:10}}>{lc.matchGame}</p>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
          {items.map(v=>{const isM=matched[v.word],isSel=sel?.val===v.word,isW=wrong===v.word;
            return(<button key={v.word} onClick={()=>!isM&&pick("word",v.word)} style={{padding:"8px 10px",borderRadius:10,fontSize:13,fontWeight:600,cursor:isM?"default":"pointer",border:isSel?"2px solid "+cat.color:isW?"2px solid #f00":"1.5px solid #ddd",background:isM?cat.bg:isSel?cat.color+"22":"#fff",color:isM?cat.color:isW?"#f00":"#333"}}>{v.emoji} {v.word} {isM&&"✓"}</button>);
          })}
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
          {meanings.map(m=>{const isM=Object.values(matched).includes(m);
            return(<button key={m} onClick={()=>!isM&&pick("meaning",m)} style={{padding:"8px 10px",borderRadius:10,fontSize:13,cursor:isM?"default":"pointer",border:"1.5px solid #ddd",background:isM?"#f0f0f0":"#fff",color:isM?"#aaa":"#333"}}>{isM&&"✓ "}{m}</button>);
          })}
        </div>
      </div>
      {done&&<p style={{textAlign:"center",fontSize:16,marginTop:10}}>🎉 {lc.correctMsg}</p>}
    </div>
  );
}

function FillBlank({et,fw,cat,lc,onClear}){
  const blanked=et.replace(new RegExp("\\b"+fw+"\\b","i"),"___");
  const [input,setInput]=useState("");const [result,setResult]=useState(null);
  const check=()=>{const ok=input.trim().toLowerCase()===fw.toLowerCase();setResult(ok?"correct":"wrong");if(ok)setTimeout(onClear,1200);};
  return(
    <div style={{marginBottom:12}}>
      <p style={{fontSize:12,color:cat.color,fontWeight:700,marginBottom:8}}>{lc.fillGame}</p>
      <p style={{fontSize:15,lineHeight:1.8,background:"#f8f8f8",borderRadius:10,padding:"10px 14px",marginBottom:8,fontFamily:"Georgia,serif"}}>{blanked}</p>
      <p style={{fontSize:12,color:"#888",marginBottom:8}}>{lc.fillHint(fw)}</p>
      <div style={{display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} placeholder={fw.slice(0,1)+"..."} style={{flex:1,fontSize:14,borderRadius:8,padding:"8px 12px",border:result==="correct"?"2px solid #1D9E75":result==="wrong"?"2px solid #f00":"1px solid #ddd"}}/>
        <button onClick={check} disabled={!input.trim()} style={{padding:"8px 14px",borderRadius:8,border:"none",background:cat.color,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{lc.checkBtn}</button>
      </div>
      {result==="correct"&&<p style={{color:"#1D9E75",fontSize:14,marginTop:8,fontWeight:700}}>{lc.correctMsg}</p>}
      {result==="wrong"&&<p style={{color:"#f00",fontSize:13,marginTop:6}}>{lc.wrongMsg} ({fw})</p>}
    </div>
  );
}

function MyCard({topic,cat,name,lc,onClear}){
  const [sent,setSent]=useState("");const [feel,setFeel]=useState("");const [draw,setDraw]=useState("");const [saved,setSaved]=useState(false);
  const save=()=>{if(!sent.trim())return;setSaved(true);setTimeout(onClear,1500);};
  if(saved)return(<div style={{textAlign:"center",padding:"1rem",background:cat.bg,borderRadius:14}}><p style={{fontSize:28,marginBottom:6}}>🏆</p><p style={{fontSize:15,fontWeight:700,color:cat.color}}>{lc.cardComplete}</p></div>);
  return(
    <div style={{marginBottom:12}}>
      <p style={{fontSize:12,color:cat.color,fontWeight:700,marginBottom:10}}>{lc.myCardGame}</p>
      <div style={{border:"2px solid "+cat.color+"44",borderRadius:14,padding:"1rem",background:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:cat.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{cat.emoji}</div>
          <div><p style={{fontSize:13,fontWeight:700,color:cat.color,margin:0}}>{lc.cardNameLbl(name)}</p><p style={{fontSize:11,color:"#888",margin:0}}>{topic}</p></div>
        </div>
        <p style={{fontSize:12,color:"#888",marginBottom:5}}>{lc.cardSentLbl}</p>
        <input value={sent} onChange={e=>setSent(e.target.value)} placeholder={lc.cardSentPh(topic)} style={{width:"100%",fontSize:14,borderRadius:8,padding:"8px 10px",border:"1.5px solid #ddd",marginBottom:10}}/>
        <p style={{fontSize:12,color:"#888",marginBottom:6}}>{lc.feelLbl}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {lc.feels.map(f=>(<button key={f} onClick={()=>setFeel(f)} style={{fontSize:11,padding:"5px 10px",borderRadius:99,cursor:"pointer",border:feel===f?"2px solid "+cat.color:"1px solid #ddd",background:feel===f?cat.bg:"#fff",color:feel===f?cat.color:"#555",fontWeight:feel===f?700:400}}>{f}</button>))}
        </div>
        <p style={{fontSize:12,color:"#888",marginBottom:6}}>{lc.drawLbl}</p>
        <input value={draw} onChange={e=>setDraw(e.target.value)} placeholder={lc.drawPh} style={{width:"100%",fontSize:18,borderRadius:8,padding:"8px 10px",border:"1.5px solid #ddd",marginBottom:12,letterSpacing:4}}/>
        <button onClick={save} disabled={!sent.trim()} style={{width:"100%",padding:"11px",borderRadius:10,border:"none",background:sent.trim()?cat.color:"#ddd",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>{lc.cardDoneBtn}</button>
      </div>
    </div>
  );
}

function YtCard({ys,cat,lc}){
  if(!ys)return null;
  const url="https://www.youtube.com/results?search_query="+encodeURIComponent(ys+" for kids");
  return(
    <a href={url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:10,background:"#fff",border:"1.5px solid "+cat.color+"44",borderRadius:12,padding:"10px 14px",marginBottom:10,textDecoration:"none"}}>
      <div style={{width:36,height:36,borderRadius:8,background:"#FF0000",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,flexShrink:0}}>▶</div>
      <div><p style={{fontSize:12,color:cat.color,fontWeight:700,margin:0}}>{lc.ytLbl}</p><p style={{fontSize:13,color:"#333",margin:0,fontWeight:500}}>"{ys} for kids"</p><p style={{fontSize:11,color:"#aaa",margin:0}}>{lc.ytSub}</p></div>
    </a>
  );
}

function LangPicker({onPick}){
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1rem"}}>
      <div style={{fontSize:52,marginBottom:12}}>🌟</div>
      <h1 style={{fontSize:24,fontWeight:700,marginBottom:4,textAlign:"center"}}>Deep Digger Kids</h1>
      <p style={{fontSize:14,color:"#888",marginBottom:"2rem",textAlign:"center",lineHeight:1.6}}>언어를 선택해줘 / Choose your language</p>
      <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:300}}>
        {Object.values(LC).map(lc=>(<button key={lc.code} onClick={()=>onPick(lc.code)} style={{padding:"16px 20px",borderRadius:14,border:"1.5px solid #e5e5e5",background:"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:28}}>{lc.flag}</span><div><p style={{fontSize:15,fontWeight:700,margin:0,color:"#333"}}>{lc.label}</p><p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>{lc.desc}</p></div></button>))}
      </div>
    </div>
  );
}

function StepPick({lang,onDone,onChangeLang}){
  const lc=LC[lang];const cats=getCats(lang);
  const [name,setName]=useState("");const [sel,setSel]=useState(null);const [warn,setWarn]=useState(false);
  const run=()=>{if(!name.trim()||!sel){setWarn(true);return;}onDone({name:name.trim(),topic:sel.tag,cat:sel.cat,lang});};
  return(
    <div style={{paddingBottom:"2rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"1rem 0"}}>
        <div><div style={{fontSize:36,marginBottom:6}}>🌟</div><h1 style={{fontSize:20,fontWeight:700,color:"#333",marginBottom:4}}>{lc.title}</h1><p style={{fontSize:13,color:"#888",lineHeight:1.6,whiteSpace:"pre-line"}}>{lc.sub}</p></div>
        <button onClick={onChangeLang} style={{fontSize:22,padding:"4px 8px",borderRadius:8,border:"1px solid #e5e5e5",background:"#fff",cursor:"pointer",flexShrink:0,marginLeft:8}}>{lc.flag}</button>
      </div>
      <div style={{marginBottom:"1.25rem"}}>
        <label style={{fontSize:13,color:"#888",display:"block",marginBottom:6}}>{lc.nameLbl}</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder={lc.namePh} style={{width:"100%",maxWidth:240,fontSize:15,borderRadius:12,border:"1px solid #ddd",padding:"10px 14px"}}/>
      </div>
      {sel&&(<div style={{margin:"0 0 1rem",padding:"10px 14px",borderRadius:12,background:sel.cat.bg,border:"2px solid "+sel.cat.color,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:22}}>{sel.cat.emoji}</span><p style={{fontSize:14,fontWeight:700,color:sel.cat.color,margin:0}}>"{sel.tag}"</p></div>)}
      <p style={{fontSize:14,fontWeight:700,color:"#555",marginBottom:10}}>{lc.pickLbl}</p>
      {cats.map((cat,ci)=>(
        <div key={ci} style={{marginBottom:"1.25rem"}}>
          <p style={{fontSize:14,fontWeight:700,color:cat.color,marginBottom:7}}>{cat.emoji} {cat.name}</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {cat.tags.map((tag,ti)=>{const on=sel?.cat===cat&&sel?.tag===tag;return(<button key={ti} onClick={()=>setSel({cat,tag})} style={{fontSize:13,padding:"6px 13px",borderRadius:99,cursor:"pointer",border:on?"2px solid "+cat.color:"1px solid #ddd",background:on?cat.bg:"#fff",color:on?cat.color:"#666",fontWeight:on?700:400,transition:"all .12s"}}>{tag}</button>);})}
          </div>
        </div>
      ))}
      {warn&&<p style={{fontSize:13,color:"#c00",background:"#fff0f0",padding:"10px 14px",borderRadius:10,marginBottom:12}}>{lc.warn}</p>}
      <button onClick={run} style={{width:"100%",padding:"14px",fontSize:16,cursor:"pointer",borderRadius:14,border:"none",background:sel&&name.trim()?"#534AB7":"#ddd",color:"#fff",fontWeight:700}}>{sel&&name.trim()?lc.startBtn(sel.tag):lc.warn}</button>
    </div>
  );
}

function StepDig({session,onRestart}){
  const {name,topic,cat,lang}=session;const lc=LC[lang];
  const [level,setLevel]=useState(0);const [cards,setCards]=useState([]);
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false);const [stars,setStars]=useState(0);
  const [gameCleared,setGameCleared]=useState({});const [vocOpen,setVocOpen]=useState(null);
  const bottomRef=useRef(null);const loadRef=useRef(false);

  const load=useCallback(async(lv,hist,replIdx)=>{
    if(loadRef.current&&replIdx===undefined)return;
    loadRef.current=true;setLoading(true);
    const lastA=hist.filter(c=>c.type==="user").slice(-1)[0]?.text||"";
    let data=null,err="";
    for(let i=0;i<3;i++){try{data=await fetchLevel(topic,cat.name,lv,lastA,lang);break;}catch(e){err=e.message;}}
    const card=data?{type:"ai",level:lv,...data}:{type:"ai",level:lv,error:true,errorMsg:err};
    if(replIdx!==undefined)setCards(p=>p.map((c,i)=>i===replIdx?card:c));
    else setCards(p=>[...p,card]);
    setLoading(false);loadRef.current=false;
  },[topic,cat.name,lang]);

  useEffect(()=>{load(0,[]);},[load]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[cards,loading]);

  const submit=()=>{
    if(!input.trim()||loading)return;
    const uc={type:"user",text:input.trim(),level};const nc=[...cards,uc];
    setCards(nc);setInput("");
    if(level>=2){setDone(true);return;}
    const next=level+1;setLevel(next);load(next,nc);
  };

  const onGC=(lv)=>{setGameCleared(p=>({...p,[lv]:true}));setStars(p=>Math.min(p+1,3));};
  const hasQ=cards.some(c=>c.type==="ai"&&c.level===level&&!c.error&&c.qk);

  if(done)return <DoneScreen name={name} topic={topic} cat={cat} lang={lang} cards={cards} stars={stars} onRestart={onRestart}/>;

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={onRestart} style={{fontSize:12,padding:"4px 10px",borderRadius:7,border:"0.5px solid #ddd",background:"#fff",cursor:"pointer"}}>{lc.back}</button>
          <span style={{fontSize:15,fontWeight:700}}>{cat.emoji} {topic}</span>
          <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:cat.bg,color:cat.color}}>{lc.flag}</span>
        </div>
        <Stars n={stars}/>
      </div>
      <div style={{display:"flex",gap:5,marginBottom:"1.25rem"}}>
        {lc.lvLabels.map((label,i)=>(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><div style={{width:"100%",height:8,borderRadius:99,transition:"background .4s",background:i<=level?LV_COLORS[i]:"#f0f0f0"}}/><span style={{fontSize:9,fontWeight:i===level?700:400,color:i<=level?LV_COLORS[i]:"#ccc"}}>{label}</span></div>))}
      </div>
      {cards.map((card,i)=>{
        if(card.type==="user")return(<div key={i} style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><div style={{maxWidth:"78%",background:cat.color,color:"#fff",borderRadius:"14px 14px 4px 14px",padding:"10px 14px",fontSize:14,lineHeight:1.6,fontWeight:500}}>{card.text}</div></div>);
        if(card.error){
          const isR=card.errorMsg&&card.errorMsg.includes("RATE_LIMIT");
          return(<div key={i} style={{background:isR?"#fff9e6":"#fff5f5",border:"1px solid "+(isR?"#fcd34d":"#fca5a5"),borderRadius:14,padding:"1rem",marginBottom:14}}>
            <p style={{fontSize:14,color:isR?"#92400e":"#c00",marginBottom:8}}>{isR?lc.rateMsg:lc.errMsg}</p>
            {!isR&&<p style={{fontSize:11,color:"#888",fontFamily:"monospace",wordBreak:"break-all",background:"#f5f5f5",padding:"6px 8px",borderRadius:6,marginBottom:8}}>{card.errorMsg}</p>}
            <button onClick={()=>load(card.level,cards.slice(0,i),i)} style={{fontSize:13,padding:"7px 18px",borderRadius:8,border:"none",background:isR?"#D97706":"#534AB7",color:"#fff",cursor:"pointer",fontWeight:600}}>{lc.retryBtn}</button>
          </div>);
        }
        const lvc=LV_COLORS[card.level];
        return(<div key={i} style={{marginBottom:20}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:5,background:lvc+"22",borderRadius:99,padding:"3px 12px",marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:lvc}}>{lc.lvLabels[card.level]} {gameCleared[card.level]&&"✅"}</span>
          </div>
          <YtCard ys={card.ys} cat={cat} lc={lc}/>
          <div style={{background:"#fafffe",border:"1.5px solid "+cat.color+"33",borderRadius:16,padding:"1rem",marginBottom:10}}>
            <p style={{fontSize:11,color:cat.color,fontWeight:700,marginBottom:7}}>{lc.passLbl}</p>
            <p style={{fontSize:15,lineHeight:1.9,color:"#222",fontFamily:"Georgia,serif",marginBottom:lc.showTr?8:0}}>{card.et}</p>
            {lc.showTr&&card.tr&&<p style={{fontSize:13,color:"#555",lineHeight:1.7,borderTop:"1px dashed "+cat.color+"44",paddingTop:8,marginBottom:8}}>{card.tr}</p>}
            {card.ff&&<div style={{background:cat.bg,borderRadius:10,padding:"8px 12px"}}><p style={{fontSize:13,color:cat.color,lineHeight:1.6,margin:0}}>{card.ff}</p></div>}
            {card.vocab&&card.vocab.length>0&&(
              <div style={{marginTop:10}}>
                <button onClick={()=>setVocOpen(vocOpen===i?null:i)} style={{fontSize:12,padding:"4px 12px",borderRadius:99,border:"1px solid "+cat.color,background:"#fff",color:cat.color,cursor:"pointer",fontWeight:700}}>{vocOpen===i?lc.vocClose:lc.vocBtn(card.vocab.length)}</button>
                {vocOpen===i&&(<div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>{card.vocab.map((v,j)=>(<div key={j} style={{background:"#fff",border:"1px solid "+cat.color+"44",borderRadius:12,padding:"8px 12px",textAlign:"center",minWidth:80}}><div style={{fontSize:20,marginBottom:4}}>{v.emoji}</div><div style={{fontSize:14,fontWeight:700,color:cat.color}}>{v.word}</div><div style={{fontSize:12,color:"#666",marginTop:2}}>{v.meaning}</div></div>))}</div>)}
              </div>
            )}
          </div>
          {card.level===0&&card.vocab?.length>=2&&(<div style={{background:"#fff",border:"1.5px solid "+cat.color+"44",borderRadius:14,padding:"1rem",marginBottom:10}}><WordMatch vocab={card.vocab} cat={cat} lc={lc} onClear={()=>onGC(0)}/></div>)}
          {card.level===1&&card.fw&&(<div style={{background:"#fff",border:"1.5px solid "+cat.color+"44",borderRadius:14,padding:"1rem",marginBottom:10}}><FillBlank et={card.et} fw={card.fw} cat={cat} lc={lc} onClear={()=>onGC(1)}/></div>)}
          {card.level===2&&(<MyCard topic={topic} cat={cat} name={name} lc={lc} onClear={()=>onGC(2)}/>)}
          {card.qk&&(<div style={{border:"2px solid "+lvc,borderRadius:14,padding:"1rem",background:"#fff"}}>
            <p style={{fontSize:12,color:lvc,fontWeight:700,marginBottom:7}}>{lc.thinkLbl}</p>
            <p style={{fontSize:16,lineHeight:1.7,color:"#222",marginBottom:6,fontWeight:500}}>{card.qk}</p>
            {lc.showTr&&card.qe&&lang!=="en"&&<p style={{fontSize:13,color:"#888",fontStyle:"italic"}}>{card.qe}</p>}
          </div>)}
        </div>);
      })}
      {loading&&<div style={{textAlign:"center",padding:"1.5rem",color:"#888",fontSize:14}}><Spin/>{lc.loadMsg(["🌱","🔍","⭐"][level])}</div>}
      <div ref={bottomRef}/>
      {!loading&&hasQ&&(
        <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"1px solid #f0f0f0",paddingTop:10,marginTop:6}}>
          <p style={{fontSize:12,color:"#aaa",marginBottom:6}}>{lc.inHint(level)}</p>
          <div style={{display:"flex",gap:8}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&e.ctrlKey)submit();}} rows={2} placeholder={lang==="en"?"Write freely...":"자유롭게 써봐..."} style={{flex:1,resize:"none",fontSize:14,borderRadius:10,border:"1px solid #ddd",padding:"8px 10px"}}/>
            <button onClick={submit} disabled={!input.trim()} style={{padding:"0 14px",borderRadius:10,border:"none",background:input.trim()?cat.color:"#ddd",color:"#fff",cursor:input.trim()?"pointer":"default",fontSize:13,fontWeight:700,flexShrink:0,minWidth:52,whiteSpace:"pre"}}>{level<2?lc.nextBtn:lc.doneBtn}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DoneScreen({name,topic,cat,lang,cards,stars,onRestart}){
  const lc=LC[lang];
  const [sum,setSum]=useState(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const answers=cards.filter(c=>c.type==="user").map(c=>c.text).join(" / ");
    const lines=[
      "Child name: "+name,
      "Topic explored: "+topic,
      "Child answers: "+answers.slice(0,200),
      "",
      "Respond with only a flat JSON object. Start with open brace.",
      "Field names:",
      "praise: 2 warm encouraging sentences in "+lc.qLang,
      "next: fun next topic in "+lc.qLang,
      "ew: one key English word",
      "em: meaning of ew in "+lc.qLang,
      "sticker: one emoji"
    ];
    callClaude("You are a children teacher. Output only a flat JSON object. No markdown. Start with open brace.",lines.join("\n"),500)
      .then(d=>setSum(d)).catch(()=>setSum(null)).finally(()=>setLoading(false));
  },[]);
  const uAns=cards.filter(c=>c.type==="user");
  const vocab=cards.filter(c=>c.type==="ai").flatMap(c=>c.vocab||[]);
  const g=sum?._g||(k=>sum?.[k]||"");
  const praise=sum?.praise||g("praise");const next=sum?.next||g("next");
  const ew=sum?.ew||g("ew");const em=sum?.em||g("em");const sticker=sum?.sticker||g("sticker");
  return(
    <div style={{paddingBottom:"2rem"}}>
      <div style={{textAlign:"center",padding:"2rem 0 1.5rem",background:"linear-gradient(135deg, "+cat.bg+" 0%, #fff 100%)",borderRadius:20,marginBottom:"1rem"}}>
        <div style={{fontSize:56,marginBottom:8}}>{loading?"⏳":sticker||"🏆"}</div>
        <h2 style={{fontSize:22,fontWeight:700,color:cat.color,marginBottom:6}}>{lc.doneTitle}</h2>
        <Stars n={stars}/>
        <p style={{fontSize:14,color:"#888",marginTop:8}}><span style={{background:cat.bg,color:cat.color,padding:"3px 10px",borderRadius:99,fontWeight:700}}>{cat.emoji} {topic}</span> {lc.doneSub}</p>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:"1rem"}}>
        {lc.lvLabels.map((label,i)=>(<div key={i} style={{flex:1,textAlign:"center",background:LV_COLORS[i]+"15",borderRadius:12,padding:"8px 4px",border:"1px solid "+LV_COLORS[i]+"44"}}><p style={{fontSize:10,color:LV_COLORS[i],fontWeight:700,margin:0}}>{label}</p><p style={{fontSize:9,color:"#aaa",margin:"2px 0 0"}}>{lc.lvDescs[i]}</p></div>))}
      </div>
      {loading?(<div style={{textAlign:"center",padding:"1.5rem",color:"#888"}}><Spin/>{lc.reportLoad}</div>)
      :sum&&(
        <>
          <div style={{background:cat.bg,border:"1.5px solid "+cat.color+"44",borderRadius:14,padding:"1.25rem",marginBottom:"1rem"}}><p style={{fontSize:15,fontWeight:700,color:cat.color,marginBottom:8}}>{lc.praiseTitle(name)}</p><p style={{fontSize:14,lineHeight:1.8,color:"#444"}}>{praise}</p></div>
          {ew&&(<div style={{display:"flex",alignItems:"center",gap:12,background:"#f7f7ff",borderRadius:14,padding:"1rem",marginBottom:"1rem"}}><div style={{background:"#534AB7",borderRadius:10,padding:"10px 14px",textAlign:"center",flexShrink:0}}><p style={{fontSize:18,fontWeight:700,color:"#fff",margin:0}}>{ew}</p></div><p style={{fontSize:14,color:"#333"}}>{em}</p></div>)}
        </>
      )}
      {vocab.length>0&&(<div style={{border:"0.5px solid #e5e5e5",borderRadius:14,padding:"1rem",marginBottom:"1rem"}}><p style={{fontSize:13,fontWeight:700,color:"#888",marginBottom:10}}>{lc.vocTot}</p><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{vocab.map((v,i)=>(<div key={i} style={{background:cat.bg,borderRadius:12,padding:"8px 12px",textAlign:"center",minWidth:64}}><div style={{fontSize:18}}>{v.emoji}</div><p style={{fontSize:13,fontWeight:700,color:cat.color,margin:"2px 0 0"}}>{v.word}</p><p style={{fontSize:11,color:"#666",margin:0}}>{v.meaning}</p></div>))}</div></div>)}
      {next&&(<div style={{border:"2px dashed "+cat.color+"88",borderRadius:14,padding:"1rem",marginBottom:"1rem"}}><p style={{fontSize:13,color:cat.color,fontWeight:700,marginBottom:4}}>{lc.nextLbl} 👀</p><p style={{fontSize:14,color:"#333"}}>⛏️ {next}</p></div>)}
      <button onClick={onRestart} style={{width:"100%",padding:"14px",fontSize:16,cursor:"pointer",borderRadius:14,border:"none",background:cat.color,color:"#fff",fontWeight:700}}>{lc.restart}</button>
    </div>
  );
}

export default function DeepDiggerKids(){
  const [lang,setLang]=useState(null);const [session,setSession]=useState(null);
  return(
    <>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}input,textarea,button{font-family:inherit}a{text-decoration:none}"}</style>
      <div style={{maxWidth:560,margin:"0 auto",padding:"1rem",fontFamily:"-apple-system,sans-serif"}}>
        {!lang?<LangPicker onPick={l=>setLang(l)}/>
        :!session?<StepPick lang={lang} onDone={s=>setSession(s)} onChangeLang={()=>{setLang(null);setSession(null);}}/>
        :<StepDig session={session} onRestart={()=>setSession(null)}/>}
      </div>
    </>
  );
}
