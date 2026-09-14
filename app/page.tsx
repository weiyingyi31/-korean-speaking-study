'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';

type Msg={role:'user'|'assistant',content:string};
type Mode='daily'|'interview';
type Analysis={
  summary?:string;
  interview_feedback?:{framework?:string;relevance?:string;fluency?:string};
  errors?:Array<{original:string;better:string;type:string;reason:string;keep?:boolean}>;
  grammar?:Array<{pattern:string;meaning:string;example:string;keep?:boolean}>;
  expressions?:Array<{text:string;meaning:string;example:string;keep?:boolean}>;
  corpus?:Array<{text:string;meaning:string;category:string;keep?:boolean}>;
  raw?:string;
};

const supabase = createSupabaseBrowserClient();
function addDays(days:number){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
function nextReview(score:number){return addDays(({1:1,2:2,3:5,4:14} as any)[score]||1);}
function weekStart(){
  const d=new Date(); const day=d.getDay()||7; d.setDate(d.getDate()-day+1);
  return d.toISOString().slice(0,10);
}

export default function Home(){
  const [view,setView]=useState('today');
  const [user,setUser]=useState<any>(null);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [authMsg,setAuthMsg]=useState('');
  const [mode,setMode]=useState<Mode>('daily');

  const [messages,setMessages]=useState<Msg[]>([]);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const [sessionId,setSessionId]=useState<string|null>(null);

  const [voiceState,setVoiceState]=useState<'idle'|'connecting'|'connected'|'error'>('idle');
  const [voiceError,setVoiceError]=useState('');
  const pcRef=useRef<RTCPeerConnection|null>(null);
  const dcRef=useRef<RTCDataChannel|null>(null);
  const micRef=useRef<MediaStream|null>(null);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const userTranscriptRef=useRef('');
  const assistantTranscriptRef=useRef('');

  const [vocab,setVocab]=useState<any[]>([]);
  const [corpus,setCorpus]=useState<any[]>([]);
  const [errors,setErrors]=useState<any[]>([]);
  const [grammar,setGrammar]=useState<any[]>([]);
  const [questions,setQuestions]=useState<any[]>([]);
  const [tasks,setTasks]=useState<any>(null);
  const [selectedQuestion,setSelectedQuestion]=useState<any>(null);
  const [frameworkDraft,setFrameworkDraft]=useState<string[]>([]);
  const [showAddQuestion,setShowAddQuestion]=useState(false);

  const [newQuestion,setNewQuestion]=useState({
  major_category: '',
  topic: '',
  day_tag: '',
  korean: '',
  chinese: '',
  framework: [] as string[]
});

  const [studyIndex,setStudyIndex]=useState(0);
  const [studyMode,setStudyMode]=useState<'vocab'|'translate'>('vocab');
  const [showAnswer,setShowAnswer]=useState(false);
  const [reviewQueue,setReviewQueue]=useState<any[]>([]);
  const [reviewIndex,setReviewIndex]=useState(0);
  const [showAddCorpus,setShowAddCorpus]=useState(false);

const [newCorpus,setNewCorpus]=useState({
  category: 'daily',
  chinese: '',
  korean: ''
});

  const [showAddGrammar,setShowAddGrammar]=useState(false);

const [newGrammar,setNewGrammar]=useState({
  pattern: '',
  meaning: '',
  example: ''
});
  
  // V1.8
  const [weeklyCorpus,setWeeklyCorpus]=useState<any[]>([]);
  const [pendingImports,setPendingImports]=useState<any[]>([]);
  const [librarySearch,setLibrarySearch]=useState('');
  const [libraryKind,setLibraryKind]=useState('all');
  const [mockQuestions,setMockQuestions]=useState<any[]>([]);
  const [mockIndex,setMockIndex]=useState(0);
  const [mockRunId,setMockRunId]=useState<string|null>(null);

  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getUser().then(({data})=>setUser(data.user||null));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{if(user)loadAll()},[user]);
  useEffect(() => {
  if (selectedQuestion) {
    setFrameworkDraft(
      Array.isArray(selectedQuestion.framework)
        ? selectedQuestion.framework
        : []
    );
  } else {
    setFrameworkDraft([]);
  }
}, [selectedQuestion]);
async function saveFramework() {
  if (!supabase || !selectedQuestion) return;

  const cleanedFramework = frameworkDraft
    .map(item => item.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from('questions')
    .update({ framework: cleanedFramework })
    .eq('id', selectedQuestion.id);

  if (error) {
    alert('回答框架保存失败：' + error.message);
    return;
  }

  setSelectedQuestion({
    ...selectedQuestion,
    framework: cleanedFramework
  });

  setQuestions(prev =>
    prev.map(q =>
      q.id === selectedQuestion.id
        ? { ...q, framework: cleanedFramework }
        : q
    )
  );

  alert('回答框架已保存');
}
  async function saveNewQuestion() {
  if (!supabase || !user) return;

  if (!newQuestion.major_category.trim()) {
    alert('请选择或填写大分类');
    return;
  }

  if (!newQuestion.topic.trim()) {
    alert('请选择或填写主题分类');
    return;
  }

  if (!newQuestion.korean.trim()) {
    alert('请填写韩语题目');
    return;
  }

  const cleanedFramework = newQuestion.framework
    .map(item => item.trim())
    .filter(Boolean);

  const { data, error } = await supabase
    .from('questions')
    .insert({
      user_id: user.id,
      major_category: newQuestion.major_category.trim(),
      topic: newQuestion.topic.trim(),
      day_tag: newQuestion.day_tag.trim() || null,
      korean: newQuestion.korean.trim(),
      chinese: newQuestion.chinese.trim() || null,
      framework: cleanedFramework,
      mastery: 'learning',
      source: '网站新增'
    })
    .select()
    .single();

  if (error) {
    alert('面试题保存失败：' + error.message);
    return;
  }

  setQuestions(prev => [...prev, data]);
  setSelectedQuestion(data);

  setNewQuestion({
    major_category: '',
    topic: '',
    day_tag: '',
    korean: '',
    chinese: '',
    framework: []
  });

  setShowAddQuestion(false);
  alert('面试题已加入题库');
}
  async function saveNewGrammar() {
  if (!supabase || !user) return;

  if (!newGrammar.pattern.trim()) {
    alert('请填写语法');
    return;
  }

  const { data, error } = await supabase
    .from('grammar')
    .insert({
      user_id: user.id,
      pattern: newGrammar.pattern.trim(),
      meaning: newGrammar.meaning.trim() || null,
      example: newGrammar.example.trim() || null,
      status: 'learning',
      source: '手动添加'
    })
    .select()
    .single();

  if (error) {
    alert('语法保存失败：' + error.message);
    return;
  }

  setGrammar(prev => [...prev, data]);

  setNewGrammar({
    pattern: '',
    meaning: '',
    example: ''
  });

  setShowAddGrammar(false);
  alert('语法已加入资料库');
}
  async function saveNewCorpus() {
  if (!supabase || !user) return;

  if (!newCorpus.korean.trim()) {
    alert('请填写韩语语料');
    return;
  }

  const { data, error } = await supabase
    .from('corpus')
    .insert({
      user_id: user.id,
      korean: newCorpus.korean.trim(),
      chinese: newCorpus.chinese.trim() || null,
      category: newCorpus.category,
      status: 'learning'
    })
    .select()
    .single();

  if (error) {
    alert('语料保存失败：' + error.message);
    return;
  }

  setCorpus(prev => [...prev, data]);

  setNewCorpus({
    category: 'daily',
    chinese: '',
    korean: ''
  });

  setShowAddCorpus(false);
  alert('语料已加入资料库');
}
  async function signIn(){
  if(!supabase||!email.trim()||!password)return;
  setAuthMsg('登录中…');

  const {error}=await supabase.auth.signInWithPassword({
    email:email.trim(),
    password
  });

  setAuthMsg(error ? error.message : '');
}
  async function signUp(){
  if(!supabase||!email.trim()||!password)return;
  setAuthMsg('注册中…');

  const {error}=await supabase.auth.signUp({
    email:email.trim(),
    password
  });

  setAuthMsg(
    error
      ? error.message
      : '注册成功，请直接登录。'
  );
}
  async function signOut(){if(supabase)await supabase.auth.signOut();setUser(null);}

  async function loadAll(){
    if(!supabase||!user)return;
    const [v,c,e,g,q,w,pending]=await Promise.all([
      supabase.from('vocabulary').select('*, vocabulary_examples(*)').order('learned_at',{ascending:true}),
      supabase.from('corpus').select('*').order('created_at',{ascending:false}),
      supabase.from('errors').select('*').order('occurrence_count',{ascending:false}),
      supabase.from('grammar').select('*').order('created_at',{ascending:false}),
      supabase.from('questions').select('*').order('day_tag',{ascending:true}),
      supabase.from('weekly_corpus').select('*, corpus(*)').eq('week_start',weekStart()).order('priority',{ascending:false}),
      supabase.from('pending_imports').select('*').eq('status','pending').order('created_at',{ascending:false})
    ]);
    setVocab(v.data||[]);setCorpus(c.data||[]);setErrors(e.data||[]);setGrammar(g.data||[]);
    setQuestions(q.data||[]);setSelectedQuestion((q.data||[])[0]||null);setWeeklyCorpus(w.data||[]);setPendingImports(pending.data||[]);
    await generateToday(v.data||[],c.data||[],e.data||[],q.data||[]);
  }

  async function importHistory(){
    if(!supabase||!user)return;
    setBusy(true);
    try{
      const seed=await fetch('/api/seed').then(r=>r.json());
      for (const x of seed.vocabulary || []) {
  const { data: existing, error: findError } = await supabase
    .from('vocabulary')
    .select('id')
    .eq('user_id', user.id)
    .eq('term', x.term)
    .maybeSingle();

  if (findError) throw findError;

  let vid = existing?.id;

  if (!vid) {
  const { error: insertError } = await supabase
    .from('vocabulary')
    .insert({
      user_id: user.id,
      term: x.term,
      zh: x.zh,
      category: x.category,
      source: '韩语每日学习材料.pdf',
      learned_at: x.date || null,
      mastery: x.mastery || 'learning'
    });

  // 23505 = 已经存在，直接继续读取原来的记录
  if (insertError && insertError.code !== '23505') {
    throw insertError;
  }

  const { data: saved, error: savedError } = await supabase
    .from('vocabulary')
    .select('id')
    .eq('user_id', user.id)
    .eq('term', x.term)
    .maybeSingle();

  if (savedError) throw savedError;

  if (!saved) {
    throw new Error(`Vocabulary could not be loaded after insert: ${x.term}`);
  }

  vid = saved.id;
}

  if (x.example && vid) {
    const { data: oldEx, error: exampleFindError } = await supabase
      .from('vocabulary_examples')
      .select('id')
      .eq('vocabulary_id', vid)
      .eq('korean', x.example)
      .limit(1)
.maybeSingle();

    if (exampleFindError) throw exampleFindError;

    if (!oldEx) {
      const { error: exampleInsertError } = await supabase
        .from('vocabulary_examples')
        .insert({
          vocabulary_id: vid,
          korean: x.example,
          chinese: x.exampleZh || '',
          source: '韩语每日学习材料.pdf'
        });

      if (exampleInsertError && exampleInsertError.code !== '23505') {
        throw exampleInsertError;
      }
    }
  }
}
      for(const x of seed.corpus||[])await supabase.from('corpus').upsert({
        user_id:user.id,korean:x.text,chinese:x.zh,category:x.category,status:x.status||'passive',source:'文本.txt / 口语复盘'
      },{onConflict:'user_id,korean'});
      for (const x of seed.errors || []) {
  const { data: old, error: findError } = await supabase
    .from('errors')
    .select('id, occurrence_count')
    .eq('user_id', user.id)
    .eq('original', x.wrong)
    .eq('better', x.correct)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (old) {
    const { error: updateError } = await supabase
      .from('errors')
      .update({
        occurrence_count: Math.max(
          old.occurrence_count || 1,
          x.count || 1
        )
      })
      .eq('id', old.id);

    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('errors')
      .insert({
        user_id: user.id,
        original: x.wrong,
        better: x.correct,
        error_type: x.type,
        reason: x.note,
        occurrence_count: Math.max(1, x.count || 1),
        source: '韩语口语练习总结.pdf'
      });

    if (insertError) throw insertError;
  }
}
      for(const x of seed.questions||[])await supabase.from('questions').upsert({
        user_id:user.id,topic:x.topic,day_tag:x.day,korean:x.question,chinese:x.zh,
        framework:x.framework||[],sample_answer:x.answer||'',mastery:x.mastery||'learning',
        source:'文本.txt / 韩国大学院面试口语练习 2.pdf'
      },{onConflict:'user_id,korean'});
      await loadAll();alert('历史学习资料已导入并去重。');
    }catch(e:any){alert('导入失败：'+(e.message||String(e)))}finally{setBusy(false)}
  }

  async function generateToday(v=vocab,c=corpus,e=errors,q=questions){
    if(!supabase||!user)return;
    const t=new Date().toISOString().slice(0,10);
    const due=(x:any)=>!x.next_review||x.next_review<=t;
    const payload={
      vocabulary:v.filter((x:any)=>x.mastery!=='mastered').slice(0,10).map((x:any)=>x.id),
      translation:v.filter(due).slice(0,15).map((x:any)=>x.id),
      questionsNew:q.filter((x:any)=>!x.last_review).slice(0,2).map((x:any)=>x.id),
      questionsReview:q.filter((x:any)=>due(x)).slice(0,6).map((x:any)=>x.id),
      errors:e.filter(due).slice(0,8).map((x:any)=>x.id),
      corpus:c.filter((x:any)=>x.status!=='active'&&due(x)).slice(0,8).map((x:any)=>x.id)
    };
    setTasks(payload);
    await supabase.from('daily_tasks').upsert({user_id:user.id,task_date:t,payload},{onConflict:'user_id,task_date'});
  }


  async function generateWeeklyCorpus(){
    if(!supabase||!user)return;
    const week=weekStart();
    const existing=await supabase.from('weekly_corpus').select('id').eq('user_id',user.id).eq('week_start',week);
    if((existing.data||[]).length){await loadAll();return;}
    const candidates=[...corpus].filter((x:any)=>x.status!=='active').slice(0,20);
    for(let i=0;i<candidates.length;i++){
      await supabase.from('weekly_corpus').insert({
        user_id:user.id,week_start:week,corpus_id:candidates[i].id,priority:20-i
      });
    }
    await loadAll();
  }

  async function startMock(){
    if(!supabase||!user||questions.length===0)return;
    const pool=[...questions].sort(()=>Math.random()-.5).slice(0,Math.min(6,questions.length));
    setMockQuestions(pool);setMockIndex(0);setMessages([]);setAnalysis(null);setInput('');
    const sid=await createSession('interview');setSessionId(sid);
    const {data:run}=await supabase.from('mock_interviews').insert({
      user_id:user.id,question_ids:pool.map((x:any)=>x.id),current_index:0
    }).select('id').single();
    setMockRunId(run?.id||null);
    const first={role:'assistant' as const,content:pool[0].korean};
    setMessages([first]);
    if(sid)await supabase.from('practice_messages').insert({session_id:sid,role:'assistant',content:first.content});
    setView('mock');
  }

  async function nextMockQuestion(){
    const n=mockIndex+1;
    if(n>=mockQuestions.length){
      if(mockRunId && supabase)await supabase.from('mock_interviews').update({completed:true,ended_at:new Date().toISOString(),current_index:mockIndex}).eq('id',mockRunId);
      await analyze(messages);
      return;
    }
    setMockIndex(n);
    if(mockRunId && supabase)await supabase.from('mock_interviews').update({current_index:n}).eq('id',mockRunId);
    const q=mockQuestions[n];
    const msg={role:'assistant' as const,content:q.korean};
    setMessages(prev=>[...prev,msg]);
    if(supabase&&sessionId)await supabase.from('practice_messages').insert({session_id:sessionId,role:'assistant',content:q.korean});
  }

  async function editItem(kind:string,item:any){
    if(!supabase)return;
    if(kind==='vocab'){
      const term=prompt('韩语词汇',item.term); if(term===null)return;
      const zh=prompt('中文释义',item.zh||''); if(zh===null)return;
      const category=prompt('分类',item.category||''); if(category===null)return;
      await supabase.from('vocabulary').update({term,zh,category}).eq('id',item.id);
    }
    if(kind==='corpus'){
  const korean=prompt('韩语语料',item.korean); if(korean===null)return;
  const chinese=prompt('中文',item.chinese||''); if(chinese===null)return;

  const categoryInput=prompt(
    '请选择分类：\n1 = 日常积累\n2 = 面试题目语料',
    item.category==='interview'?'2':'1'
  );

  if(categoryInput===null)return;

  const category=
    categoryInput==='2'
      ? 'interview'
      : 'daily';

  await supabase.from('corpus').update({
    korean,
    chinese,
    category
  }).eq('id',item.id);

  await loadAll();
}
    if(kind==='errors'){
      const original=prompt('原表达',item.original); if(original===null)return;
      const better=prompt('推荐表达',item.better); if(better===null)return;
      await supabase.from('errors').update({original,better}).eq('id',item.id);
    }
    if(kind==='grammar'){
      const pattern=prompt('语法',item.pattern); if(pattern===null)return;
      const meaning=prompt('含义',item.meaning||''); if(meaning===null)return;
      await supabase.from('grammar').update({pattern,meaning}).eq('id',item.id);
    }
    if(kind==='questions'){
      const korean=prompt('韩语题目',item.korean); if(korean===null)return;
      const chinese=prompt('中文题意',item.chinese||''); if(chinese===null)return;
      await supabase.from('questions').update({korean,chinese}).eq('id',item.id);
    }
    await loadAll();
  }

  async function deleteItem(kind:string,id:string){
    if(!supabase||!confirm('确认删除这条记录？'))return;
    const table:any={vocab:'vocabulary',corpus:'corpus',errors:'errors',grammar:'grammar',questions:'questions'}[kind];
    if(table)await supabase.from(table).delete().eq('id',id);
    await loadAll();
  }

  async function createSession(m:Mode){
    if(!supabase||!user)return null;
    const {data,error}=await supabase.from('practice_sessions').insert({user_id:user.id,mode:m}).select('id').single();
    if(error)throw error;return data.id as string;
  }

  async function startTextChat(m:Mode){
    if(!user){setView('login');return}
    setMode(m);setMessages([]);setAnalysis(null);setBusy(true);
    try{
      const sid=await createSession(m);setSessionId(sid);
      const first=m==='daily'
        ? '오늘 하루는 어땠어요? 오늘 있었던 일 중에서 가장 기억에 남는 일을 이야기해 주세요.'
        : (selectedQuestion?.korean||'자기소개를 간단히 해 주세요.');
      const msg={role:'assistant' as const,content:first};setMessages([msg]);
      if(supabase&&sid)await supabase.from('practice_messages').insert({session_id:sid,role:'assistant',content:first});
      setView('chat');
    }finally{setBusy(false)}
  }

  async function sendText(){
    const text=input.trim();if(!text||busy)return;
    const userMsg={role:'user' as const,content:text};const next=[...messages,userMsg];
    setMessages(next);setInput('');setBusy(true);
    try{
      if(supabase&&sessionId)await supabase.from('practice_messages').insert({session_id:sessionId,role:'user',content:text});
      const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        mode,messages:next,questionContext:mode==='interview'?JSON.stringify(selectedQuestion||{}):''
      })});
      const j=await r.json();const ai={role:'assistant' as const,content:j.text||j.error||'请求失败'};
      setMessages([...next,ai]);
      if(supabase&&sessionId)await supabase.from('practice_messages').insert({session_id:sessionId,role:'assistant',content:ai.content});
    }finally{setBusy(false)}
  }

  async function startVoice(m:Mode){
    if(!user)return;
    setMode(m);setMessages([]);setAnalysis(null);setVoiceError('');setVoiceState('connecting');
    try{
      const sid=await createSession(m);setSessionId(sid);
      const qctx=m==='interview'?JSON.stringify(selectedQuestion||{}):'';
      const secretResp=await fetch('/api/realtime-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:m,questionContext:qctx})});
      const secretJson=await secretResp.json();
      if(!secretResp.ok)throw new Error(secretJson.error||'无法创建Realtime会话');
      const ephemeral=secretJson.value || secretJson.client_secret?.value;
      if(!ephemeral)throw new Error('未获得Realtime临时密钥');

      const pc=new RTCPeerConnection();pcRef.current=pc;
      const audio=document.createElement('audio');audio.autoplay=true;audioRef.current=audio;
      pc.ontrack=e=>{audio.srcObject=e.streams[0]};

      const stream=await navigator.mediaDevices.getUserMedia({audio:true});micRef.current=stream;
      stream.getTracks().forEach(track=>pc.addTrack(track,stream));

      const dc=pc.createDataChannel('oai-events');dcRef.current=dc;
      dc.onopen=()=>{
        setVoiceState('connected');
        if(m==='daily'){
          dc.send(JSON.stringify({type:'response.create',response:{instructions:'用一句简短自然的韩语开始今天的日常对话，让用户先多说。'}}));
        }else{
          dc.send(JSON.stringify({type:'response.create',response:{instructions:`只提问这一题，不要先给提示或答案：${selectedQuestion?.korean||''}`}}));
        }
      };
      dc.onmessage=async e=>{
        let ev:any;try{ev=JSON.parse(e.data)}catch{return}
        if(ev.type==='conversation.item.input_audio_transcription.delta'){
          userTranscriptRef.current+=ev.delta||'';
        }
        if(ev.type==='conversation.item.input_audio_transcription.completed'){
          const txt=(ev.transcript||userTranscriptRef.current).trim();userTranscriptRef.current='';
          if(txt){
            setMessages(prev=>[...prev,{role:'user',content:txt}]);
            if(supabase&&sid)await supabase.from('practice_messages').insert({session_id:sid,role:'user',content:txt});
          }
        }
        if(ev.type==='response.audio_transcript.delta'){
          assistantTranscriptRef.current+=ev.delta||'';
        }
        if(ev.type==='response.audio_transcript.done'){
          const txt=(ev.transcript||assistantTranscriptRef.current).trim();assistantTranscriptRef.current='';
          if(txt){
            setMessages(prev=>[...prev,{role:'assistant',content:txt}]);
            if(supabase&&sid)await supabase.from('practice_messages').insert({session_id:sid,role:'assistant',content:txt});
          }
        }
        if(ev.type==='error')setVoiceError(ev.error?.message||'Realtime错误');
      };

      const offer=await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResp=await fetch('https://api.openai.com/v1/realtime/calls',{
        method:'POST',
        body:offer.sdp,
        headers:{'Authorization':`Bearer ${ephemeral}`,'Content-Type':'application/sdp'}
      });
      if(!sdpResp.ok)throw new Error(await sdpResp.text());
      const answer={type:'answer' as RTCSdpType,sdp:await sdpResp.text()};
      await pc.setRemoteDescription(answer);
      setView('voice');
    }catch(e:any){
      setVoiceState('error');setVoiceError(e.message||String(e));stopVoice(false);
    }
  }

  async function stopVoice(runAnalysis=true){
    micRef.current?.getTracks().forEach(t=>t.stop());micRef.current=null;
    dcRef.current?.close();dcRef.current=null;
    pcRef.current?.close();pcRef.current=null;
    if(audioRef.current)audioRef.current.srcObject=null;
    setVoiceState('idle');
    if(supabase&&sessionId)await supabase.from('practice_sessions').update({ended_at:new Date().toISOString(),analysis_status:'pending'}).eq('id',sessionId);
    if(runAnalysis&&messages.length)await analyze(messages);
  }

  async function analyze(sourceMessages=messages){
    const transcript=sourceMessages.map(m=>`${m.role==='user'?'USER':'AI'}: ${m.content}`).join('\n');
    if(!transcript||busy)return;
    setBusy(true);
    try{
      const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,transcript})});
      const j:Analysis=await r.json();
      for(const group of ['errors','grammar','expressions','corpus'] as const){
        if(Array.isArray((j as any)[group]))(j as any)[group]=(j as any)[group].map((x:any)=>({...x,keep:true}));
      }
      setAnalysis(j);
      if(supabase&&sessionId){
        await supabase.from('practice_analysis').insert({session_id:sessionId,result:j,approved:false});
        await supabase.from('practice_sessions').update({analysis_status:'ready'}).eq('id',sessionId);
      }
    }finally{setBusy(false)}
  }

  async function saveAnalysis(){
    if(!supabase||!user||!analysis)return;
    setBusy(true);
    try{
      for(const x of analysis.errors||[]){
        if(!x.keep)continue;
        const {data:old}=await supabase.from('errors').select('*').eq('user_id',user.id).eq('original',x.original).eq('better',x.better).maybeSingle();
        if(old)await supabase.from('errors').update({occurrence_count:(old.occurrence_count||1)+1,last_seen:new Date().toISOString().slice(0,10),next_review:addDays(1)}).eq('id',old.id);
        else await supabase.from('errors').insert({user_id:user.id,original:x.original,better:x.better,error_type:x.type,reason:x.reason,next_review:addDays(1),source:'AI口语复盘'});
      }
      for(const x of analysis.grammar||[])if(x.keep)await supabase.from('grammar').upsert({user_id:user.id,pattern:x.pattern,meaning:x.meaning,example:x.example,source:'AI口语复盘',next_review:addDays(2)},{onConflict:'user_id,pattern'});
     for(const x of analysis.corpus||[])if(x.keep)await supabase.from('corpus').upsert({
  user_id:user.id,
  korean:x.text,
  chinese:x.meaning,
  category:x.category==='interview'?'interview':'daily',
  status:'semi',
  source:'AI口语复盘',
  next_review:addDays(2)
},{onConflict:'user_id,korean'});

for(const x of analysis.expressions||[])if(x.keep)await supabase.from('corpus').upsert({
  user_id:user.id,
  korean:x.text,
  chinese:x.meaning,
  category:'daily',
  status:'semi',
  source:'AI口语复盘',
  next_review:addDays(2)
},{onConflict:'user_id,korean'});
      if(sessionId)await supabase.from('practice_analysis').update({approved:true}).eq('session_id',sessionId);
      await loadAll();alert('已保存到云端学习资料库。');
    }finally{setBusy(false)}
  }

  function toggleKeep(group:keyof Analysis,index:number){
    if(!analysis)return;
    const copy:any={...analysis};copy[group]=[...(copy[group] as any[])];
    copy[group][index]={...copy[group][index],keep:!copy[group][index].keep};setAnalysis(copy);
  }


  async function reviewPending(item:any, approve:boolean){
    if(!supabase||!user)return;
    if(!approve){
      await supabase.from('pending_imports').update({
        status:'rejected',reviewed_at:new Date().toISOString()
      }).eq('id',item.id).eq('user_id',user.id);
      await loadAll();
      return;
    }
    const p=item.payload||{};
    for(const x of p.errors||[]){
      if(!x?.original||!x?.better)continue;
      const {data:old}=await supabase.from('errors').select('*')
        .eq('user_id',user.id).eq('original',x.original).eq('better',x.better).maybeSingle();
      if(old)await supabase.from('errors').update({
        occurrence_count:(old.occurrence_count||1)+1,
        last_seen:item.practiced_at,next_review:item.practiced_at
      }).eq('id',old.id);
      else await supabase.from('errors').insert({
        user_id:user.id,original:x.original,better:x.better,error_type:x.type||'',
        reason:x.reason||'',next_review:item.practiced_at,source:'ChatGPT同步'
      });
    }
    for(const x of p.grammar||[]){
      if(!x?.pattern)continue;
      await supabase.from('grammar').upsert({
        user_id:user.id,pattern:x.pattern,meaning:x.meaning||'',example:x.example||'',
        source:'ChatGPT同步',next_review:item.practiced_at
      },{onConflict:'user_id,pattern'});
    }
    for(const x of [...(p.expressions||[]),...(p.corpus||[])]){
      const korean=x.text||x.korean;if(!korean)continue;
      await supabase.from('corpus').upsert({
        user_id:user.id,korean,chinese:x.meaning||x.chinese||'',
        category:x.category==='interview'?'interview':'daily',status:'semi',
        source:'ChatGPT同步',next_review:item.practiced_at
      },{onConflict:'user_id,korean'});
    }
    await supabase.from('pending_imports').update({
      status:'approved',reviewed_at:new Date().toISOString()
    }).eq('id',item.id).eq('user_id',user.id);
    await loadAll();
  }

  async function rate(table:string,id:string,score:number){
    if(!supabase)return;
    const mastery=score===4?'mastered':score===3?'good':'learning';
    await supabase.from(table).update({mastery,last_review:new Date().toISOString().slice(0,10),next_review:nextReview(score)}).eq('id',id);
    await loadAll();
  }

  const studyList=useMemo(()=>{
    if(!tasks)return[];
    const ids=studyMode==='vocab'?tasks.vocabulary:tasks.translation;
    return ids.map((id:string)=>vocab.find(x=>x.id===id)).filter(Boolean);
  },[tasks,vocab,studyMode]);
  const currentStudy=studyList[studyIndex]||null;

  function buildReview(){
  if(!tasks)return[];

  const list:any[]=[];

  for(const id of tasks.errors||[]){
    const x=errors.find(a=>a.id===id);
    if(x)list.push({kind:'error',x});
  }

  for(const id of tasks.corpus||[]){
    const x=corpus.find(a=>a.id===id);
    if(x)list.push({kind:'corpus',x});
  }

  for(const id of tasks.questionsReview||[]){
    const x=questions.find(a=>a.id===id);
    if(x)list.push({kind:'question',x});
  }
    
for(const id of tasks.vocabulary||[]){
  const x=vocab.find(a=>a.id===id);
  if(x)list.push({kind:'vocab',x});
}
    
  for(const id of tasks.translation||[]){
    const x=vocab.find(a=>a.id===id);
    if(x)list.push({kind:'translation',x});
  }

  return list;
}
  useEffect(()=>{setReviewQueue(buildReview());setReviewIndex(0)},[tasks,errors,corpus,questions,vocab]);


  const libraryItems=useMemo(()=>{
    const q=librarySearch.toLowerCase().trim(); const out:any[]=[];
    const add=(kind:string,id:string,title:string,sub:string,raw:string,item:any)=>{
      if((libraryKind==='all'||libraryKind===kind)&&(!q||raw.toLowerCase().includes(q))){
        out.push({kind,id,title,sub,item});
      }
    };
    vocab.forEach(x=>add(
  'vocab',
  x.id,
  x.term || '',
  (x.zh || '') + (x.category ? ' · ' + x.category : ''),
  (x.term || '') + (x.zh || '') + (x.category || '') + (x.vocabulary_examples?.[0]?.korean || ''),
  x
));
    corpus.forEach(x=>add(
  'corpus',
  x.id,
  x.korean,
  (x.chinese||'')+' · '+(
    x.category==='interview'
      ? '面试题目语料'
      : x.category==='daily'
        ? '日常积累'
        : '未分类'
  ),
  (x.korean||'')+(x.chinese||'')+(x.category||'')+(x.status||''),
  x
));
    errors.forEach(x=>add('errors',x.id,x.better,'易错：'+x.original,x.original+x.better+x.error_type+x.reason,x));
    grammar.forEach(x=>add('grammar',x.id,x.pattern,x.meaning,x.pattern+x.meaning+x.example,x));
    questions.forEach(x=>add('questions',x.id,x.korean,x.topic+' · '+x.day_tag,x.korean+x.chinese+x.topic+x.sample_answer,x));
    return out.slice(0,200);
  },[librarySearch,libraryKind,vocab,corpus,errors,grammar,questions]);

  if(!supabase)return <main className="wrap"><div className="panel"><h1>需要配置 Supabase</h1><p className="muted">请先配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。</p></div></main>;

  if(!user)return <main className="wrap"><div className="hero"><h1>오늘의 한국어</h1><p className="muted">登录后，手机和电脑会同步同一套学习数据。</p><input
  className="search"
  value={email}
  onChange={e=>setEmail(e.target.value)}
  placeholder="邮箱"
/>

<input
  className="search"
  type="password"
  value={password}
  onChange={e=>setPassword(e.target.value)}
  placeholder="密码"
/>

<div className="tabs">
  <button className="btn primary" onClick={signIn}>
    登录
  </button>

  <button className="btn" onClick={signUp}>
    第一次使用，注册
  </button>
</div><p className="small muted">{authMsg}</p></div></main>;

  return <main className="wrap">
    {view==='today'&&<>
      <div className="top"><div><h1>오늘의 한국어</h1><div className="muted">{user.email}</div></div><button className="btn" onClick={signOut}>退出</button></div>
      <section className="hero"><h2>60 Day Speaking Project</h2><div className="muted">今日任务由真实学习进度自动生成。</div></section>
      {vocab.length===0&&questions.length===0&&<div className="panel"><h2>第一次使用</h2><p className="muted">导入你之前整理的专业词汇、文本.txt、题库和口语复盘。</p><button className="btn primary" disabled={busy} onClick={importHistory}>{busy?'导入中…':'导入我的历史学习资料'}</button></div>}
      <div className="grid">
        <div className="card"><h2>📚 词汇与表达</h2><div className="muted">专业词汇 {tasks?.vocabulary?.length||0} · 中译韩 {tasks?.translation?.length||0}</div><button className="btn" onClick={()=>{setStudyIndex(0);setView('study')}}>进入</button></div>
        <div className="card"><h2>🎤 口语练习</h2><div className="muted">日常语音建议继续在 ChatGPT 完成；结束后自动同步到本网站。</div><button className="btn primary" onClick={()=>setView('speaking')}>开始</button></div>
        <div className="card"><h2>🎧 输入与跟读</h2><div className="muted">Shadowing · 综艺</div><button className="btn" onClick={()=>setView('input')}>进入</button></div>
        <div className="card"><h2>🧠 今日复习</h2><div className="muted">当前 {reviewQueue.length} 项</div><button className="btn" onClick={()=>setView('review')}>进入</button></div>
      </div>
      <div className="section-title">本周主动语料</div>
      <div className="panel">
        {weeklyCorpus.length===0
          ? <><div className="muted">本周还没有目标语料。</div><button className="btn" onClick={generateWeeklyCorpus}>生成本周20条目标语料</button></>
          : <div>{weeklyCorpus.map((w:any)=><span className="pill" key={w.id}>{w.corpus?.korean}</span>)}</div>}
      </div>
    </>}

      <div className="section-title">ChatGPT 同步</div>
      <div className="panel">
        <div className="row">
          <div><b>待审核练习</b><div className="small muted">ChatGPT 里的语音/文字练习可以同步到这里。练习记录直接保存；错误、语法和语料需审核后入库。</div></div>
          <span className="pill">{pendingImports.length} 待审核</span>
        </div>
        {pendingImports.slice(0,3).map((x:any)=><div className="row" key={x.id}>
          <div><b>{x.practice_type||'口语练习'}</b><div className="small muted">{x.practiced_at} · {x.payload?.summary||'等待审核'}</div></div>
          <div className="tabs"><button className="btn primary" onClick={()=>reviewPending(x,true)}>批准入库</button><button className="btn" onClick={()=>reviewPending(x,false)}>忽略</button></div>
        </div>)}
      </div>

    {view==='study'&&<>
      <button className="btn" onClick={()=>setView('today')}>← 返回</button><h1 style={{marginTop:14}}>📚 词汇与表达</h1>
      <div className="tabs"><button className={'tab '+(studyMode==='vocab'?'active':'')} onClick={()=>{setStudyMode('vocab');setStudyIndex(0);setShowAnswer(false)}}>专业词汇</button><button className={'tab '+(studyMode==='translate'?'active':'')} onClick={()=>{setStudyMode('translate');setStudyIndex(0);setShowAnswer(false)}}>中译韩</button></div>
      <div className="panel">
        {!currentStudy?<div className="muted">今天这一部分已完成或暂无数据。</div>:<>
          <div className="small muted">{studyIndex+1} / {studyList.length}</div>
          {studyMode==='vocab'?<>
            <h2>{currentStudy.term}</h2><p>{currentStudy.zh}</p><span className="pill">{currentStudy.category}</span>
            <div className="panel">{currentStudy.vocabulary_examples?.[0]?.korean||'暂无例句'}<br/><span className="muted">{currentStudy.vocabulary_examples?.[0]?.chinese||''}</span></div>
          </>:<>
            <h2>中译韩</h2><p style={{fontSize:18}}>{currentStudy.vocabulary_examples?.[0]?.chinese||currentStudy.zh}</p>
            <button className="btn" onClick={()=>setShowAnswer(!showAnswer)}>查看 / 隐藏参考</button>
            {showAnswer&&<div className="panel">{currentStudy.vocabulary_examples?.[0]?.korean||currentStudy.term}</div>}
          </>}
          <div className="tabs">{[['😵 不会',1],['😐 困难',2],['🙂 掌握',3],['😎 熟练',4]].map(([label,score]:any)=><button className="btn" key={score} onClick={async()=>{await rate('vocabulary',currentStudy.id,score);setStudyIndex(i=>i+1);setShowAnswer(false)}}>{label}</button>)}</div>
        </>}
      </div>
    </>}

    {view==='speaking'&&<>
      <button className="btn" onClick={()=>setView('today')}>← 返回</button><h1 style={{marginTop:14}}>🎤 口语练习</h1>
      <div className="grid">
        <div className="card"><h2>💬 日常对话</h2><div className="muted">不频繁纠错，结束后统一复盘。</div><div className="tabs"><button className="btn" onClick={()=>startTextChat('daily')}>文字</button><button className="btn primary" onClick={()=>startVoice('daily')}>网站语音（备用）</button></div></div>
        <div className="card"><h2>🎓 单题面试</h2><div className="muted">回答中不打断，不即时纠错。</div><div className="tabs"><button className="btn" onClick={()=>startTextChat('interview')}>文字</button><button className="btn primary" onClick={()=>startVoice('interview')}>网站语音（备用）</button></div></div>
        <div className="card"><h2>🧪 正式模拟</h2><div className="muted">随机抽6题，逐题回答，中途不显示框架、不纠错。</div><button className="btn primary" onClick={startMock}>开始模拟</button></div>
      </div>
      <div style={{ marginBottom: 14 }}>
  <button
    className="btn primary"
    type="button"
    onClick={() => setShowAddQuestion(!showAddQuestion)}
  >
    {showAddQuestion ? '收起新增题目' : '＋ 添加面试题'}
  </button>
</div>

{showAddQuestion && (
  <div className="panel" style={{ marginBottom: 16 }}>
    <h2>新增面试题</h2>

    <div className="muted" style={{ marginBottom: 6 }}>大分类</div>
    <input
      className="search"
      list="major-category-list"
      value={newQuestion.major_category}
      placeholder="例如：专业问题"
      onChange={e =>
        setNewQuestion({
          ...newQuestion,
          major_category: e.target.value
        })
      }
    />
    <datalist id="major-category-list">
      {Array.from(
        new Set(
          questions
            .map(q => q.major_category)
            .filter(Boolean)
        )
      ).map(category => (
        <option key={category} value={category} />
      ))}
    </datalist>

    <div className="muted" style={{ marginTop: 12, marginBottom: 6 }}>
      主题分类
    </div>
    <input
      className="search"
      list="topic-list"
      value={newQuestion.topic}
      placeholder="例如：研究对象"
      onChange={e =>
        setNewQuestion({
          ...newQuestion,
          topic: e.target.value
        })
      }
    />
    <datalist id="topic-list">
      {Array.from(
        new Set(
          questions
            .filter(
              q =>
                !newQuestion.major_category ||
                q.major_category === newQuestion.major_category
            )
            .map(q => q.topic)
            .filter(Boolean)
        )
      ).map(topic => (
        <option key={topic} value={topic} />
      ))}
    </datalist>

    <div className="muted" style={{ marginTop: 12, marginBottom: 6 }}>
      DAY
    </div>
    <input
      className="search"
      value={newQuestion.day_tag}
      placeholder="例如：DAY17"
      onChange={e =>
        setNewQuestion({
          ...newQuestion,
          day_tag: e.target.value
        })
      }
    />

    <div className="muted" style={{ marginTop: 12, marginBottom: 6 }}>
      韩语题目
    </div>
    <input
      className="search"
      value={newQuestion.korean}
      placeholder="输入韩语题目"
      onChange={e =>
        setNewQuestion({
          ...newQuestion,
          korean: e.target.value
        })
      }
    />

    <div className="muted" style={{ marginTop: 12, marginBottom: 6 }}>
      中文题目
    </div>
    <input
      className="search"
      value={newQuestion.chinese}
      placeholder="输入中文题目"
      onChange={e =>
        setNewQuestion({
          ...newQuestion,
          chinese: e.target.value
        })
      }
    />

    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>
        回答框架
      </div>

      {newQuestion.framework.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 8
          }}
        >
          <input
            className="search"
            value={item}
            placeholder={`框架要点 ${index + 1}`}
            onChange={e => {
              const next = [...newQuestion.framework];
              next[index] = e.target.value;

              setNewQuestion({
                ...newQuestion,
                framework: next
              });
            }}
          />

          <button
            className="btn"
            type="button"
            onClick={() =>
              setNewQuestion({
                ...newQuestion,
                framework: newQuestion.framework.filter(
                  (_, i) => i !== index
                )
              })
            }
          >
            删除
          </button>
        </div>
      ))}

      <button
        className="btn"
        type="button"
        onClick={() =>
          setNewQuestion({
            ...newQuestion,
            framework: [...newQuestion.framework, '']
          })
        }
      >
        ＋ 添加框架要点
      </button>
    </div>

    <div style={{ marginTop: 16 }}>
      <button
        className="btn primary"
        type="button"
        onClick={saveNewQuestion}
      >
        保存到题库
      </button>
    </div>
  </div>
)}
     <div className="panel">
  <h2>当前面试题</h2>

  <div className="muted" style={{ marginBottom: 6 }}>大分类</div>
  <select
    className="search"
    value={selectedQuestion?.major_category || ''}
    onChange={e => {
      const firstQuestion = questions.find(
        q => q.major_category === e.target.value
      );
      if (firstQuestion) setSelectedQuestion(firstQuestion);
    }}
  >
    {Array.from(
      new Set(
        questions
          .map(q => q.major_category)
          .filter(Boolean)
      )
    ).map(category => (
      <option key={category} value={category}>
        {category}
      </option>
    ))}
  </select>

  <div className="muted" style={{ marginTop: 12, marginBottom: 6 }}>
    主题分类
  </div>
  <select
    className="search"
    value={selectedQuestion?.topic || ''}
    onChange={e => {
      const firstQuestion = questions.find(
        q =>
          q.major_category === selectedQuestion?.major_category &&
          q.topic === e.target.value
      );
      if (firstQuestion) setSelectedQuestion(firstQuestion);
    }}
  >
    {Array.from(
      new Set(
        questions
          .filter(
            q =>
              q.major_category === selectedQuestion?.major_category
          )
          .map(q => q.topic)
          .filter(Boolean)
      )
    ).map(topic => (
      <option key={topic} value={topic}>
        {topic}
      </option>
    ))}
  </select>

  <div className="muted" style={{ marginTop: 12, marginBottom: 6 }}>
    具体问题
  </div>
  <select
    className="search"
    value={selectedQuestion?.id || ''}
    onChange={e =>
      setSelectedQuestion(
        questions.find(q => q.id === e.target.value)
      )
    }
  >
    {questions
      .filter(
        q =>
          q.major_category === selectedQuestion?.major_category &&
          q.topic === selectedQuestion?.topic
      )
      .map(q => (
        <option key={q.id} value={q.id}>
          {q.day_tag || ''} · {q.korean}
        </option>
      ))}
  </select>

  <p style={{ lineHeight: 1.6 }}>
    {selectedQuestion?.korean || '请先导入题库'}
  </p>

  <div style={{ marginTop: 18 }}>
  <div style={{ fontWeight: 600, marginBottom: 10 }}>
    回答框架
  </div>

  {frameworkDraft.map((item, index) => (
    <div
      key={index}
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 8
      }}
    >
      <input
        className="search"
        value={item}
        placeholder={`框架要点 ${index + 1}`}
        onChange={e => {
          const next = [...frameworkDraft];
          next[index] = e.target.value;
          setFrameworkDraft(next);
        }}
      />

      <button
        className="btn"
        type="button"
        onClick={() =>
          setFrameworkDraft(
            frameworkDraft.filter((_, i) => i !== index)
          )
        }
      >
        删除
      </button>
    </div>
  ))}

  <div
    style={{
      display: 'flex',
      gap: 8,
      marginTop: 10
    }}
  >
    <button
      className="btn"
      type="button"
      onClick={() =>
        setFrameworkDraft([...frameworkDraft, ''])
      }
    >
      ＋ 添加一条
    </button>

    <button
      className="btn primary"
      type="button"
      onClick={saveFramework}
      disabled={!selectedQuestion}
    >
      保存框架
    </button>
  </div>
</div>
</div>
    </>}


    {view==='mock'&&<>
      <button className="btn" onClick={()=>setView('speaking')}>← 退出模拟</button>
      <h1 style={{marginTop:14}}>🧪 正式模拟面试</h1>
      <div className="panel">
        <div className="small muted">第 {mockIndex+1} / {mockQuestions.length} 题</div>
        <h2 style={{lineHeight:1.6}}>{mockQuestions[mockIndex]?.korean}</h2>
        <div className="chat">{messages.map((m,i)=><div key={i} className={'msg '+(m.role==='user'?'user':'ai')}>{m.content}</div>)}</div>
        <div className="chatbar"><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="用韩语回答本题。"/><button className="btn primary" onClick={sendText}>发送</button></div>
        <button className="btn" onClick={nextMockQuestion}>{mockIndex+1>=mockQuestions.length?'完成并统一复盘':'下一题'}</button>
      </div>
      {analysis&&<AnalysisPanel data={analysis} toggleKeep={toggleKeep} save={saveAnalysis} busy={busy}/>}
    </>}

    {view==='chat'&&<>
      <button className="btn" onClick={()=>setView('speaking')}>← 返回</button><h1 style={{marginTop:14}}>{mode==='daily'?'💬 日常对话':'🎓 面试练习'}</h1>
      <div className="panel"><div className="chat">{messages.map((m,i)=><div key={i} className={'msg '+(m.role==='user'?'user':'ai')}>{m.content}</div>)}{busy&&<div className="msg ai muted">생각 중...</div>}</div>
      <div className="chatbar"><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="输入韩语…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendText()}}}/><button className="btn primary" onClick={sendText}>发送</button></div>
      <button className="btn" onClick={()=>analyze(messages)} disabled={busy}>结束并AI复盘</button></div>
      {analysis&&<AnalysisPanel data={analysis} toggleKeep={toggleKeep} save={saveAnalysis} busy={busy}/>}
    </>}

    {view==='voice'&&<>
      <button className="btn" onClick={async()=>{await stopVoice(false);setView('speaking')}}>← 退出语音</button>
      <h1 style={{marginTop:14}}>{mode==='daily'?'🎙 日常实时语音':'🎙 面试实时语音'}</h1>
      <div className="panel">
        <div className={'voice-orb '+(voiceState==='connected'?'live':'')}>🎤</div>
        <h2>{voiceState==='connecting'?'正在连接…':voiceState==='connected'?'正在进行韩语对话':'语音已结束'}</h2>
        {voiceError&&<p className="error-text">{voiceError}</p>}
        <p className="muted">允许 Safari 使用麦克风。AI 会直接用韩语语音回复；转写会自动保存。</p>
        <button className="btn primary" onClick={async()=>{await stopVoice(false);await analyze(messages);setView('voice')}} disabled={voiceState!=='connected'}>结束语音并生成复盘</button>
      </div>
      <div className="panel"><h2>实时转写</h2><div className="chat">{messages.map((m,i)=><div key={i} className={'msg '+(m.role==='user'?'user':'ai')}>{m.content}</div>)}</div></div>
      {analysis&&<AnalysisPanel data={analysis} toggleKeep={toggleKeep} save={saveAnalysis} busy={busy}/>}
    </>}

    {view==='review'&&<ReviewPanel queue={reviewQueue} index={reviewIndex} setIndex={setReviewIndex} rate={rate}/>}

    {view==='input'&&<>
      <button className="btn" onClick={()=>setView('today')}>← 返回</button><h1 style={{marginTop:14}}>🎧 输入与跟读</h1>
      <div className="grid"><div className="card"><h2>Shadowing</h2><p className="muted">保持简单：听力 + 跟读肌肉记忆。</p><input type="file" accept="audio/*"/></div><div className="card"><h2>综艺</h2><p className="muted">不强制整理，只作为真实韩语输入。</p></div></div>
    </>}

    {view==='library'&&<>
      <button className="btn" onClick={()=>setView('today')}>← 返回</button><h1 style={{marginTop:14}}>📖 我的资料库</h1>
      <div style={{marginBottom:14}}>
  <button
    className="btn primary"
    type="button"
    onClick={()=>setShowAddCorpus(!showAddCorpus)}
  >
    {showAddCorpus ? '收起新增语料' : '＋ 添加语料'}
  </button>
</div>

{showAddCorpus && (
  <div className="panel" style={{marginBottom:16}}>
    <h2>新增语料</h2>

    <div className="muted" style={{marginBottom:6}}>
      分类
    </div>

    <select
      className="search"
      value={newCorpus.category}
      onChange={e=>
        setNewCorpus({
          ...newCorpus,
          category:e.target.value
        })
      }
    >
      <option value="daily">日常积累</option>
      <option value="interview">面试题目语料</option>
    </select>

    <div className="muted" style={{marginTop:12,marginBottom:6}}>
      中文
    </div>

    <input
      className="search"
      value={newCorpus.chinese}
      placeholder="输入中文"
      onChange={e=>
        setNewCorpus({
          ...newCorpus,
          chinese:e.target.value
        })
      }
    />

    <div className="muted" style={{marginTop:12,marginBottom:6}}>
      韩语
    </div>

    <input
      className="search"
      value={newCorpus.korean}
      placeholder="输入韩语语料"
      onChange={e=>
        setNewCorpus({
          ...newCorpus,
          korean:e.target.value
        })
      }
    />

    <div style={{marginTop:16}}>
      <button
        className="btn primary"
        type="button"
        onClick={saveNewCorpus}
      >
        保存到语料库
      </button>
    </div>
  </div>
)}
            <div style={{marginBottom:14}}>
        <button
          className="btn primary"
          type="button"
          onClick={()=>setShowAddGrammar(!showAddGrammar)}
        >
          {showAddGrammar ? '收起新增语法' : '＋ 添加语法'}
        </button>
      </div>

      {showAddGrammar && (
        <div className="panel" style={{marginBottom:16}}>
          <h2>新增语法</h2>

          <div className="muted" style={{marginBottom:6}}>
            语法
          </div>
          <input
            className="search"
            value={newGrammar.pattern}
            onChange={e=>setNewGrammar({
              ...newGrammar,
              pattern:e.target.value
            })}
            placeholder="例如：-는 데"
          />

          <div className="muted" style={{marginTop:12,marginBottom:6}}>
            中文释义 / 用法
          </div>
          <input
            className="search"
            value={newGrammar.meaning}
            onChange={e=>setNewGrammar({
              ...newGrammar,
              meaning:e.target.value
            })}
            placeholder="例如：表示背景、情况或对比"
          />

          <div className="muted" style={{marginTop:12,marginBottom:6}}>
            韩语例句
          </div>
          <input
            className="search"
            value={newGrammar.example}
            onChange={e=>setNewGrammar({
              ...newGrammar,
              example:e.target.value
            })}
            placeholder="输入韩语例句"
          />

          <div style={{marginTop:16}}>
            <button
              className="btn primary"
              type="button"
              onClick={saveNewGrammar}
            >
              保存到语法库
            </button>
          </div>
        </div>
      )}
      <input className="search" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="搜索：판본 / 연구 방법 / ~을 바탕으로 ..." />
      <div className="tabs">
        {[['all','全部'],['vocab','专业词汇'],['corpus','语料'],['errors','错误'],['grammar','语法'],['questions','面试题']].map(([k,label]:any)=>
          <button key={k} className={'tab '+(libraryKind===k?'active':'')} onClick={()=>setLibraryKind(k)}>{label}</button>)}
      </div>
      <div className="panel">
        {libraryItems.map((x:any)=><div className="row" key={x.kind+x.id}>
          <div><b>{x.title}</b><div className="small muted">{x.sub}</div></div>
          <div className="tabs"><button className="btn" onClick={()=>editItem(x.kind,x.item)}>编辑</button><button className="btn" onClick={()=>deleteItem(x.kind,x.id)}>删除</button></div>
        </div>)}
      </div>
      <div className="panel"><button className="btn" disabled={busy} onClick={importHistory}>重新执行历史资料去重导入</button></div>
    </>}

    <div className="bottom"><div><button className={'nav '+(view==='today'?'active':'')} onClick={()=>setView('today')}>🏠<br/>今日</button><button className={'nav '+(view==='study'?'active':'')} onClick={()=>setView('study')}>📚<br/>学习</button><button className={'nav '+(['speaking','chat','voice','mock'].includes(view)?'active':'')} onClick={()=>setView('speaking')}>🎤<br/>口语</button><button className={'nav '+(view==='review'?'active':'')} onClick={()=>setView('review')}>🧠<br/>复习</button><button className={'nav '+(view==='library'?'active':'')} onClick={()=>setView('library')}>📖<br/>资料库</button></div></div>
  </main>
}

function AnalysisPanel({data,toggleKeep,save,busy}:{data:Analysis,toggleKeep:any,save:any,busy:boolean}){
  return <div className="panel"><h2>本次AI复盘</h2><p>{data.summary}</p>
    {data.interview_feedback&&<div className="panel"><b>面试反馈</b><p>框架：{data.interview_feedback.framework}</p><p>切题：{data.interview_feedback.relevance}</p><p>流畅：{data.interview_feedback.fluency}</p></div>}
    {(['errors','grammar','expressions','corpus'] as const).map(group=>{
      const arr=(data as any)[group] as any[]|undefined;if(!arr?.length)return null;
      const names:any={errors:'错误',grammar:'语法',expressions:'词汇/表达',corpus:'共用语料'};
      return <div key={group}><h3>{names[group]}</h3>{arr.map((x,i)=><div className="row" key={i}><label><input type="checkbox" checked={x.keep!==false} onChange={()=>toggleKeep(group,i)}/> {group==='errors'?`${x.original} → ${x.better}`:group==='grammar'?x.pattern:x.text}</label><div className="small muted">{x.reason||x.meaning||x.category||x.example}</div></div>)}</div>
    })}
    <button className="btn primary" disabled={busy} onClick={save}>保存选中内容到云端资料库</button>
  </div>
}

function ReviewPanel({queue,index,setIndex,rate}:{queue:any[],index:number,setIndex:any,rate:any}){
  const [category,setCategory]=useState('all');
  const filteredQueue =
  category === 'all'
    ? queue
    : queue.filter(item => item.kind === category);
  useEffect(()=>{
  setIndex(0);
},[category]);
  const item=filteredQueue[index];
 

  if(!item){
  return (
    <div>
      <h1>🧠 今日复习</h1>

      <div className="tabs" style={{marginBottom:16}}>
        {[
          ['all','全部'],
          ['vocab','专业词汇'],
          ['translation','中译韩'],
          ['error','错误表达'],
          ['corpus','个人语料'],
          ['question','面试题']
        ].map(([key,label])=>(
          <button
            key={key}
            className={`btn ${category===key?'primary':''}`}
            onClick={()=>setCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel">
        <h2>这个分类今天没有需要复习的内容</h2>
      </div>
    </div>
  );
}

const x=item.x;
let prompt='',answer='';

if(item.kind==='error'){
  prompt=`把这个表达改得更自然：${x.original}`;
  answer=x.better;
}

if(item.kind==='corpus'){
  prompt=`请用韩语表达：${x.chinese||x.korean}`;
  answer=x.korean;
}

if(item.kind==='question'){
  prompt=x.korean;
  answer=(x.framework||[]).join(' → ');
}

if(item.kind==='vocab'){
  prompt=`解释或造句：${x.term}`;
  answer=x.vocabulary_examples?.[0]?.korean||x.zh;
}

if(item.kind==='translation'){
  prompt=`请翻译成韩语：${x.zh||x.term}`;
  answer=x.term;
}

const table=
  item.kind==='question'?'questions':
  item.kind==='vocab'?'vocabulary':
  item.kind==='translation'?'vocabulary':
  item.kind==='corpus'?'corpus':
  null;
  return (
  <div>
    <h1>🧠 今日复习</h1>

    <div className="tabs" style={{marginBottom:16}}>
      {[
        ['all','全部'],
        ['vocab','专业词汇'],
        ['translation','中译韩'],
        ['error','错误表达'],
        ['corpus','个人语料'],
        ['question','面试题']
      ].map(([key,label])=>(
        <button
          key={key}
          className={`btn ${category===key?'primary':''}`}
          onClick={()=>setCategory(key)}
        >
          {label}
        </button>
      ))}
    </div>

    <div className="panel">
      <div className="small muted">
        {index+1} / {filteredQueue.length}
      </div>

      <h2 style={{lineHeight:1.6}}>
        {prompt}
      </h2>

      <details>
        <summary>查看参考</summary>
        <div className="panel">{answer}</div>
      </details>

      <div className="tabs">
        {[
          ['😵 不会',1],
          ['😐 困难',2],
          ['🙂 掌握',3],
          ['😎 熟练',4]
        ].map(([label,score]:any)=>(
          <button
            className="btn"
            key={score}
            onClick={async()=>{
              if(table)await rate(table,x.id,score);
              setIndex((i:number)=>i+1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  </div>
);
}
