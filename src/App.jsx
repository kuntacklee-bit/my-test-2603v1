import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { db } from './firebase'
import {
  doc, onSnapshot, setDoc, getDoc
} from 'firebase/firestore'

// ─── 상수 ────────────────────────────────────────────────────────────────────
const MAX_FAIL  = 5
const DOC_REF   = doc(db, 'gratitude-coins', 'state')   // Firestore 단일 문서

const AVATARS = [
  '👨‍💼','👩‍💻','👨‍🎨','👩‍🔬','👨‍🍳','🧑‍🏫',
  '👨‍🎤','👩‍🚀','🧑‍💼','👩‍🎨','🧑‍🔬','👩‍🍳',
]

// ─── 초기 Firestore 문서 구조 ─────────────────────────────────────────────────
const INIT_STATE = {
  adminPassword: 'admin1234',
  members: [
    { id:'d1', name:'김민준', email:'minjun@company.com', team:'개발팀',   part:'프론트엔드', avatar:'👨‍💼', password:null, failedAttempts:0, locked:false, registeredAt:null },
    { id:'d2', name:'이서연', email:'seoyeon@company.com', team:'개발팀',  part:'백엔드',     avatar:'👩‍💻', password:null, failedAttempts:0, locked:false, registeredAt:null },
    { id:'d3', name:'박지호', email:'jiho@company.com',   team:'디자인팀', part:'UX',         avatar:'👨‍🎨', password:null, failedAttempts:0, locked:false, registeredAt:null },
    { id:'d4', name:'최하은', email:'haeun@company.com',  team:'마케팅팀', part:'콘텐츠',     avatar:'👩‍🔬', password:null, failedAttempts:0, locked:false, registeredAt:null },
    { id:'d5', name:'정우진', email:'woojin@company.com', team:'운영팀',   part:'총무',       avatar:'👨‍🍳', password:null, failedAttempts:0, locked:false, registeredAt:null },
  ],
  transactions: [],
  allotments:   {},
  distributed:  {},
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────
const getCurrentMonth = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
}
const getLastDay = m => { const [y,mo]=m.split('-').map(Number); return new Date(y,mo,0).getDate() }
const fmtDate    = d => { const x=new Date(d); return `${x.getFullYear()}년 ${x.getMonth()+1}월 ${x.getDate()}일` }
const todayStr   = () => new Date().toISOString().split('T')[0]

// ─── Excel 저장 다이얼로그 ────────────────────────────────────────────────────
async function saveExcel(wb, fileName) {
  const out  = XLSX.write(wb, { bookType:'xlsx', type:'array' })
  const blob = new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  if (window.showSaveFilePicker) {
    try {
      const fh = await window.showSaveFilePicker({
        suggestedName: fileName,
        types:[{ description:'Excel 파일', accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']} }],
      })
      const w = await fh.createWritable()
      await w.write(blob); await w.close()
      return
    } catch(e) { if (e.name==='AbortError') return }
  }
  const url=URL.createObjectURL(blob), a=document.createElement('a')
  a.href=url; a.download=fileName; document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────
function HistoryTab({ transactions, members, onExport }) {
  const cm = getCurrentMonth()
  const [filterMonth,  setFilterMonth]  = useState(cm)
  const [filterMember, setFilterMember] = useState('')

  const filtered = transactions
    .filter(t => !filterMonth  || t.month  === filterMonth)
    .filter(t => !filterMember || t.fromId === filterMember || t.toId === filterMember)
    .sort((a,b) => b.date.localeCompare(a.date))

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:'#fbbf24',marginBottom:10}}>🔍 필터</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div>
            <label style={S.lbl}>월 선택</label>
            <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
              style={{...S.inp,fontSize:13}} />
          </div>
          <div>
            <label style={S.lbl}>회원 필터</label>
            <select value={filterMember} onChange={e=>setFilterMember(e.target.value)} style={S.sel}>
              <option value="">전체 회원</option>
              {members.filter(m=>m.password).map(m=>(
                <option key={m.id} value={m.id}>{m.name} ({m.team})</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:13,color:'#d4c4a0'}}>총 <strong style={{color:'#fbbf24'}}>{filtered.length}</strong>건</span>
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <button style={{background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)',color:'#86efac',padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}
              onClick={()=>onExport(filtered, filterMonth)}>📥 Excel 다운로드</button>
            <button style={{background:'rgba(107,114,128,0.15)',border:'1px solid rgba(107,114,128,0.3)',color:'#9ca3af',padding:'7px 12px',borderRadius:8,fontSize:12,cursor:'pointer'}}
              onClick={()=>{setFilterMonth('');setFilterMember('')}}>초기화</button>
          </div>
        </div>
      </div>

      <div style={{...S.card,padding:0,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'90px 1fr 1fr 50px 1fr',background:'rgba(251,191,36,0.1)',borderBottom:'1px solid rgba(251,191,36,0.18)',padding:'10px 14px',fontSize:11,fontWeight:700,color:'#fbbf24'}}>
          <span>날짜</span><span>보낸사람</span><span>받은사람</span><span style={{textAlign:'center'}}>🪙</span><span>메세지</span>
        </div>
        {filtered.length===0
          ? <div style={{padding:'32px 16px',textAlign:'center',color:'#78350f',fontSize:13}}>해당 조건의 이력이 없습니다.</div>
          : <div style={{maxHeight:460,overflowY:'auto'}}>
              {filtered.map((tx,i)=>{
                const f=members.find(m=>m.id===tx.fromId), t2=members.find(m=>m.id===tx.toId)
                return (
                  <div key={tx.id} style={{display:'grid',gridTemplateColumns:'90px 1fr 1fr 50px 1fr',padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',background:i%2?'rgba(255,255,255,0.015)':'transparent',alignItems:'start'}}>
                    <span style={{fontSize:11,color:'#78350f'}}>{fmtDate(tx.date)}</span>
                    <div><div style={{fontSize:12,fontWeight:700}}>{f?.avatar} {f?.name}</div><div style={{fontSize:10,color:'#78350f'}}>{f?.team}</div></div>
                    <div><div style={{fontSize:12,fontWeight:700}}>{t2?.avatar} {t2?.name}</div><div style={{fontSize:10,color:'#78350f'}}>{t2?.team}</div></div>
                    <div style={{textAlign:'center',fontSize:16}}>🪙</div>
                    <div style={{fontSize:12,color:'#d97706',fontStyle:'italic',wordBreak:'break-all'}}>"{tx.message}"</div>
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}

// ─── IndividualRow ────────────────────────────────────────────────────────────
function IndividualRow({ member, currentCoins, onGive }) {
  const [amt, setAmt] = useState(3)
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
      <span style={{fontSize:20}}>{member.avatar}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13,color:'#fef3c7'}}>{member.name}</div>
        <div style={{fontSize:11,color:'#78350f',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{member.team} · {member.part}</div>
      </div>
      <span style={{fontSize:11,color:'#92400e',whiteSpace:'nowrap'}}>잔여 {currentCoins}개</span>
      <input type="number" min={1} max={99} value={amt}
        style={{width:46,textAlign:'center',padding:'4px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:8,color:'#fef3c7',fontSize:13}}
        onChange={e=>setAmt(Math.max(1,Number(e.target.value)))} />
      <button style={{background:'rgba(251,191,36,0.18)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:8,padding:'4px 10px',color:'#fbbf24',cursor:'pointer',fontSize:12,fontWeight:700}}
        onClick={()=>onGive(member.id,amt)}>+지급</button>
    </div>
  )
}

// ─── Input 컴포넌트 ────────────────────────────────────────────────────────────
function Inp({ label, type='text', placeholder, value, onChange, onEnter, error }) {
  return (
    <div style={{marginBottom:12}}>
      {label && <label style={{display:'block',fontSize:12,fontWeight:700,color:'#fbbf24',marginBottom:5}}>{label}</label>}
      <input type={type} placeholder={placeholder} value={value}
        style={{...S.inp,border:`1px solid ${error?'#ef4444':'rgba(251,191,36,0.2)'}`}}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>e.key==='Enter'&&onEnter&&onEnter()} />
      {error && <p style={{color:'#f87171',fontSize:12,margin:'4px 0 0',fontWeight:600}}>{error}</p>}
    </div>
  )
}


// ─── PWA 설치 프롬프트 ────────────────────────────────────────────────────────
function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // 이미 설치된 경우
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    const handler = e => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setPrompt(null) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  return { prompt, isInstalled, install }
}


// ─── iOS 설치 안내 배너 ────────────────────────────────────────────────────────
function IOSInstallBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const dismissed = sessionStorage.getItem('ios-banner-dismissed')
    if (isIOS && !isStandalone && !dismissed) setShow(true)
  }, [])
  if (!show) return null
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,background:'linear-gradient(135deg,#1c0800,#2d1200)',borderTop:'1px solid rgba(251,191,36,0.3)',padding:'14px 16px',zIndex:998,boxShadow:'0 -4px 20px rgba(0,0,0,0.5)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
        <span style={{fontSize:28}}>🪙</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:14,color:'#fbbf24'}}>iPhone에 앱 설치하기</div>
          <div style={{fontSize:12,color:'#92400e',marginTop:2}}>Safari 하단 공유 버튼을 탭하세요</div>
        </div>
        <button onClick={()=>{sessionStorage.setItem('ios-banner-dismissed','1');setShow(false)}}
          style={{background:'transparent',border:'none',color:'#78350f',cursor:'pointer',fontSize:20,padding:'4px 8px'}}>✕</button>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(251,191,36,0.08)',borderRadius:10,padding:'10px 12px'}}>
        <span style={{fontSize:22}}>1</span>
        <span style={{fontSize:13,color:'#d97706'}}>하단 <strong style={{color:'#fbbf24'}}>공유(□↑)</strong> 버튼 탭</span>
        <span style={{fontSize:22,marginLeft:'auto'}}>→</span>
        <span style={{fontSize:22}}>2</span>
        <span style={{fontSize:13,color:'#d97706'}}><strong style={{color:'#fbbf24'}}>홈 화면에 추가</strong> 선택</span>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [appState,   setAppState]   = useState(null)
  const [syncing,    setSyncing]    = useState(false)  // 저장 중 표시
  const { prompt: installPrompt, isInstalled, install } = useInstallPrompt()
  const [view,       setView]       = useState('home')
  const [modal,      setModal]      = useState(null)
  const [notif,      setNotif]      = useState(null)
  const [adminTab,   setAdminTab]   = useState('coins')
  const localUser    = useRef(null)   // 로그인한 사용자 ID (로컬 세션)
  const localAdmin   = useRef(false)  // 관리자 여부 (로컬 세션)

  // ── 로그인 폼 ──
  const [loginEmail,  setLoginEmail]  = useState('')
  const [loginPw,     setLoginPw]     = useState('')
  const [loginErr,    setLoginErr]    = useState('')
  // ── 회원가입 폼 ──
  const [regName,     setRegName]     = useState('')
  const [regEmail,    setRegEmail]    = useState('')
  const [regStep,     setRegStep]     = useState(1)
  const [regFound,    setRegFound]    = useState(null)
  const [regPw,       setRegPw]       = useState('')
  const [regPw2,      setRegPw2]      = useState('')
  const [regErr,      setRegErr]      = useState('')
  // ── 관리자 ──
  const [adminPw,     setAdminPw]     = useState('')
  const [adminPwErr,  setAdminPwErr]  = useState(false)
  const [resetId,     setResetId]     = useState(null)
  const [resetPw,     setResetPw]     = useState('')
  const [adminChgOld, setAdminChgOld] = useState('')
  const [adminChgNew, setAdminChgNew] = useState('')
  const [adminChgNew2,setAdminChgNew2]= useState('')
  const [adminChgErr, setAdminChgErr] = useState('')
  // ── 회원 비밀번호 변경 ──
  const [mbrChgOld,  setMbrChgOld]  = useState('')
  const [mbrChgNew,  setMbrChgNew]  = useState('')
  const [mbrChgNew2, setMbrChgNew2] = useState('')
  const [mbrChgErr,  setMbrChgErr]  = useState('')
  // ── 관리자 패널 ──
  const [bulkDefault,   setBulkDefault]   = useState(3)
  const [customCoins,   setCustomCoins]   = useState({})
  const [distMonth,     setDistMonth]     = useState(getCurrentMonth())
  const [newMbr,        setNewMbr]        = useState({name:'',email:'',team:'',part:''})
  const [newMbrErr,     setNewMbrErr]     = useState('')
  const [excelFileName, setExcelFileName] = useState('')
  // ── 보내기 ──
  const [sendTo,  setSendTo]  = useState('')
  const [sendMsg, setSendMsg] = useState('')

  // ── Firestore 실시간 리스너 ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(DOC_REF, async snap => {
      if (snap.exists()) {
        const data = snap.data()
        setAppState({
          ...INIT_STATE,
          ...data,
          members: (data.members || INIT_STATE.members).map((m,i) => ({
            failedAttempts: 0, locked: false,
            avatar: AVATARS[i % AVATARS.length],
            ...m,
          })),
        })
      } else {
        // 첫 실행: Firestore에 초기 데이터 생성
        await setDoc(DOC_REF, INIT_STATE)
        setAppState({ ...INIT_STATE })
      }
    }, err => {
      console.error('Firestore 연결 오류:', err)
      setAppState({ ...INIT_STATE })
    })
    return () => unsub()
  }, [])

  // ── Firestore 저장 ──────────────────────────────────────────────────────────
  const persist = async (partial) => {
    if (!appState) return
    const next = { ...appState, ...partial }
    setAppState(next)
    setSyncing(true)
    try {
      await setDoc(DOC_REF, next)
    } catch(e) {
      notify('저장 오류가 발생했습니다.', 'err')
    }
    setSyncing(false)
  }

  const notify = (msg, type='ok') => {
    setNotif({msg,type})
    setTimeout(()=>setNotif(null), 3500)
  }

  const closeModal = () => {
    setModal(null)
    setLoginEmail(''); setLoginPw(''); setLoginErr('')
    setRegName(''); setRegEmail(''); setRegStep(1); setRegFound(null)
    setRegPw(''); setRegPw2(''); setRegErr('')
    setAdminPw(''); setAdminPwErr(false)
    setResetId(null); setResetPw('')
    setAdminChgOld(''); setAdminChgNew(''); setAdminChgNew2(''); setAdminChgErr('')
    setMbrChgOld(''); setMbrChgNew(''); setMbrChgNew2(''); setMbrChgErr('')
  }

  if (!appState) return (
    <div style={S.loading}>
      <div style={{fontSize:60}}>🪙</div>
      <p style={{color:'#fbbf24',fontSize:18,margin:0}}>Firebase 연결 중...</p>
      <p style={{color:'#92400e',fontSize:13,margin:0}}>잠시만 기다려 주세요</p>
    </div>
  )

  // ── 편의 변수 ──────────────────────────────────────────────────────────────
  const { members, transactions, allotments, distributed } = appState
  const isAdmin    = localAdmin.current
  const currentUser= members.find(m=>m.id===localUser.current) ?? null
  const cm         = getCurrentMonth()
  const [yr, mo]   = cm.split('-')
  const lastDay    = getLastDay(cm)
  const getCoins   = (uid, month) => allotments[month]?.[uid] ?? 0
  const myCoins    = currentUser ? getCoins(currentUser.id, cm) : 0
  const myReceived = currentUser ? transactions.filter(t=>t.toId===currentUser.id&&t.month===cm) : []
  const mySent     = currentUser ? transactions.filter(t=>t.fromId===currentUser.id&&t.month===cm) : []
  const isDistributed = !!distributed[cm]
  const regMembers = members.filter(m=>m.password)
  const ranking    = [...regMembers].map(m=>({...m, received:transactions.filter(t=>t.toId===m.id&&t.month===cm).length})).sort((a,b)=>b.received-a.received)

  // ── 로그인 ────────────────────────────────────────────────────────────────
  const doLogin = () => {
    const email = loginEmail.trim().toLowerCase()
    const m = members.find(x=>x.email.toLowerCase()===email)
    if (!m)          { setLoginErr('등록되지 않은 이메일입니다.'); return }
    if (!m.password) { setLoginErr('회원가입이 필요합니다. 회원가입 버튼을 눌러주세요.'); return }
    if (m.locked||(m.failedAttempts??0)>=MAX_FAIL) { setLoginErr('계정이 잠겼습니다. 관리자에게 잠금 해제를 요청하세요.'); return }
    if (m.password !== loginPw) {
      const fails   = (m.failedAttempts??0)+1
      const nowLock = fails >= MAX_FAIL
      persist({ members: members.map(x=>x.id===m.id?{...x,failedAttempts:fails,locked:nowLock}:x) })
      setLoginErr(nowLock ? '비밀번호 5회 오류. 계정이 잠겼습니다.' : `비밀번호 오류 (${MAX_FAIL-fails}회 남음)`)
      return
    }
    persist({ members: members.map(x=>x.id===m.id?{...x,failedAttempts:0,locked:false}:x) })
    localUser.current  = m.id
    localAdmin.current = false
    closeModal()
    notify(`${m.name}님, 환영합니다! 🪙`)
  }

  const doAdminLogin = () => {
    if (adminPw !== appState.adminPassword) { setAdminPwErr(true); return }
    localUser.current  = null
    localAdmin.current = true
    closeModal(); setView('admin')
    notify('관리자 로그인 성공 🔑')
  }

  const logout = () => {
    localUser.current  = null
    localAdmin.current = false
    setView('home')
    notify('로그아웃 되었습니다.')
  }

  // ── 회원가입 ──────────────────────────────────────────────────────────────
  const doRegSearch = () => {
    const email = regEmail.trim().toLowerCase()
    const name  = regName.trim()
    if (!email||!email.includes('@')) { setRegErr('올바른 이메일을 입력해주세요.'); return }
    if (!name)                        { setRegErr('이름을 입력해주세요.'); return }
    const found = members.find(m=>m.email.toLowerCase()===email && m.name===name)
    if (!found)         { setRegErr('이름/이메일이 회원 DB와 일치하지 않습니다. 관리자에게 문의하세요.'); return }
    if (found.password) { setRegErr('이미 가입이 완료된 계정입니다. 로그인해주세요.'); return }
    setRegFound(found); setRegErr(''); setRegStep(2)
  }

  const doRegComplete = () => {
    if (!regPw||regPw.length<4) { setRegErr('비밀번호는 4자 이상이어야 합니다.'); return }
    if (regPw!==regPw2)         { setRegErr('비밀번호가 일치하지 않습니다.'); return }
    if (!regFound)              { setRegErr('처음부터 다시 시도해주세요.'); return }
    const next = members.map(m=>m.id===regFound.id?{...m,password:regPw,registeredAt:todayStr(),failedAttempts:0,locked:false}:m)
    persist({ members: next })
    localUser.current  = regFound.id
    localAdmin.current = false
    closeModal()
    notify(`${regFound.name}님, 가입을 환영합니다! 🎉`)
  }

  // ── 회원: 비밀번호 변경 ─────────────────────────────────────────────────
  const doMemberChangePw = () => {
    if (!currentUser) return
    if (mbrChgOld !== currentUser.password)   { setMbrChgErr('현재 비밀번호가 올바르지 않습니다.'); return }
    if (!mbrChgNew || mbrChgNew.length < 4)   { setMbrChgErr('새 비밀번호는 4자 이상이어야 합니다.'); return }
    if (mbrChgNew !== mbrChgNew2)             { setMbrChgErr('새 비밀번호가 일치하지 않습니다.'); return }
    persist({ members: members.map(m => m.id === currentUser.id ? {...m, password: mbrChgNew} : m) })
    setMbrChgOld(''); setMbrChgNew(''); setMbrChgNew2(''); setMbrChgErr('')
    notify('비밀번호가 변경되었습니다. 🔑')
  }

  // ── 관리자: 비밀번호 변경 ────────────────────────────────────────────────
  const doChangeAdminPw = () => {
    if (adminChgOld !== appState.adminPassword) { setAdminChgErr('현재 비밀번호가 올바르지 않습니다.'); return }
    if (!adminChgNew||adminChgNew.length<4)      { setAdminChgErr('새 비밀번호는 4자 이상이어야 합니다.'); return }
    if (adminChgNew!==adminChgNew2)              { setAdminChgErr('새 비밀번호가 일치하지 않습니다.'); return }
    persist({ adminPassword: adminChgNew })
    closeModal(); notify('관리자 비밀번호가 변경되었습니다. 🔑')
  }

  // ── 관리자: 회원 관리 ────────────────────────────────────────────────────
  const addMember = () => {
    const { name, email, team, part } = newMbr
    if (!name.trim())                        return setNewMbrErr('이름을 입력해주세요.')
    if (!email.trim()||!email.includes('@')) return setNewMbrErr('올바른 이메일을 입력해주세요.')
    if (members.some(m=>m.email.toLowerCase()===email.trim().toLowerCase())) return setNewMbrErr('이미 존재하는 이메일입니다.')
    const m = { id:`m${Date.now()}`, name:name.trim(), email:email.trim().toLowerCase(), team:team.trim(), part:part.trim(), avatar:AVATARS[members.length%AVATARS.length], password:null, failedAttempts:0, locked:false, registeredAt:null }
    persist({ members:[...members,m] })
    setNewMbr({name:'',email:'',team:'',part:''}); setNewMbrErr('')
    notify(`${m.name}님이 추가되었습니다.`)
  }

  const removeMember = id => {
    persist({ members: members.filter(m=>m.id!==id) })
    notify('회원이 삭제되었습니다.')
  }

  const unlockMember = id => {
    persist({ members: members.map(m=>m.id===id?{...m,failedAttempts:0,locked:false}:m) })
    notify('잠금이 해제되었습니다.')
  }

  const doResetPw = () => {
    if (!resetPw||resetPw.length<4) { notify('4자 이상 입력해주세요.','err'); return }
    persist({ members: members.map(m=>m.id===resetId?{...m,password:resetPw,failedAttempts:0,locked:false}:m) })
    closeModal(); notify('비밀번호가 재설정되었습니다.')
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  const handleExcelImport = async e => {
    const file = e.target.files[0]; if (!file) return
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, {type:'array'})
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
    let added=0, skipped=0
    const next = [...members]
    rows.forEach((row,i)=>{
      const name  = String(row['이름']||row['name']||'').trim()
      const email = String(row['이메일']||row['email']||'').trim().toLowerCase()
      const team  = String(row['팀']||row['team']||'').trim()
      const part  = String(row['파트']||row['part']||'').trim()
      if (!name||!email||!email.includes('@')||next.some(m=>m.email===email)) { skipped++; return }
      next.push({id:`m${Date.now()}${i}`,name,email,team,part,avatar:AVATARS[next.length%AVATARS.length],password:null,failedAttempts:0,locked:false,registeredAt:null})
      added++
    })
    persist({ members: next })
    notify(`완료: ${added}명 추가, ${skipped}명 스킵`)
    e.target.value=''
  }

  const downloadTemplate = async () => {
    const ws = XLSX.utils.json_to_sheet([{이름:'홍길동',이메일:'hong@company.com',팀:'개발팀',파트:'프론트엔드'}])
    ws['!cols']=[{wch:12},{wch:25},{wch:12},{wch:12}]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'회원DB')
    await saveExcel(wb,'회원DB_양식.xlsx')
  }

  const exportDB = async () => {
    const rows = members.map(m=>({이름:m.name,이메일:m.email,팀:m.team||'',파트:m.part||'',상태:m.password?'가입완료':'미가입',가입일:m.registeredAt||''}))
    const ws = XLSX.utils.json_to_sheet(rows); ws['!cols']=[{wch:12},{wch:25},{wch:12},{wch:12},{wch:10},{wch:12}]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'회원목록')
    await saveExcel(wb,`회원목록_${cm}.xlsx`)
  }

  const exportHistory = async (filtered, filterMonth) => {
    const rows = filtered.map(tx=>{
      const f=members.find(m=>m.id===tx.fromId), t2=members.find(m=>m.id===tx.toId)
      return { 날짜:tx.date, 월:tx.month, 보낸사람:f?.name||'', 보낸사람팀:f?.team||'', 받은사람:t2?.name||'', 받은사람팀:t2?.team||'', 코인수:1, 메세지:tx.message }
    })
    if (!rows.length) { notify('내보낼 이력이 없습니다.','err'); return }
    const ws = XLSX.utils.json_to_sheet(rows); ws['!cols']=[{wch:12},{wch:8},{wch:10},{wch:10},{wch:10},{wch:10},{wch:6},{wch:40}]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'코인이력')
    await saveExcel(wb,`코인이력${filterMonth?'_'+filterMonth:''}.xlsx`)
  }

  // ── 코인 ─────────────────────────────────────────────────────────────────
  const distributeAll = () => {
    if (distributed[distMonth]) return notify('이미 해당 월에 지급했습니다.','err')
    const reg = members.filter(m=>m.password)
    if (!reg.length) return notify('가입 완료된 회원이 없습니다.','err')
    const newAllot = {...allotments,[distMonth]:{...(allotments[distMonth]||{})}}
    reg.forEach(m=>{
      const amt = customCoins[m.id]!==undefined ? Number(customCoins[m.id]) : Number(bulkDefault)||1
      newAllot[distMonth][m.id] = (newAllot[distMonth][m.id]??0)+amt
    })
    persist({ allotments:newAllot, distributed:{...distributed,[distMonth]:{date:todayStr(),defaultAmt:bulkDefault}} })
    setCustomCoins({})
    notify(`${distMonth} 코인 지급 완료! 🪙`)
  }

  const giveOne = (memberId, amount) => {
    const newAllot = {...allotments,[distMonth]:{...(allotments[distMonth]||{}),[memberId]:(allotments[distMonth]?.[memberId]??0)+Number(amount)}}
    persist({ allotments:newAllot })
    notify(`${members.find(x=>x.id===memberId)?.name}님에게 ${amount}개 지급.`)
  }

  const sendCoin = () => {
    if (!currentUser||!sendTo||!sendMsg.trim()) return notify('모든 항목을 입력해주세요.','err')
    if (sendTo===currentUser.id) return notify('자신에게 줄 수 없습니다.','err')
    const avail = getCoins(currentUser.id, cm)
    if (avail<=0) return notify('사용 가능한 코인이 없습니다.','err')
    const newAllot = {...allotments,[cm]:{...allotments[cm],[currentUser.id]:avail-1}}
    const newTx = {id:`tx${Date.now()}`,fromId:currentUser.id,toId:sendTo,message:sendMsg.trim(),date:todayStr(),month:cm}
    persist({ allotments:newAllot, transactions:[...transactions,newTx] })
    setSendTo(''); setSendMsg(''); setView('history')
    notify('코인을 전달했습니다! 🪙✨')
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <div style={S.orb1}/><div style={S.orb2}/>

      {/* 동기화 표시 */}
      {syncing && <div style={S.syncBadge}>☁️ 저장 중...</div>}

      {/* PWA 설치 배너 */}
      {installPrompt && !isInstalled && (
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'linear-gradient(135deg,#1c0800,#2d1200)',borderTop:'1px solid rgba(251,191,36,0.3)',padding:'14px 16px',display:'flex',alignItems:'center',gap:12,zIndex:998,boxShadow:'0 -4px 20px rgba(0,0,0,0.5)'}}>
          <span style={{fontSize:32}}>🪙</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:14,color:'#fbbf24'}}>앱으로 설치하기</div>
            <div style={{fontSize:12,color:'#92400e',marginTop:2}}>홈 화면에 추가하면 앱처럼 사용할 수 있어요</div>
          </div>
          <button onClick={install}
            style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',border:'none',borderRadius:10,padding:'9px 18px',color:'#1a0a00',fontWeight:800,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>
            설치
          </button>
          <button onClick={()=>setPrompt&&null}
            style={{background:'transparent',border:'none',color:'#78350f',cursor:'pointer',fontSize:18,padding:'4px 8px'}}
            onClick={()=>{ document.querySelector('[data-install-banner]')?.remove() }}>✕</button>
        </div>
      )}

      {/* iOS 설치 안내 */}
      <IOSInstallBanner />

      {/* 알림 */}
      {notif && <div style={{...S.notif,...(notif.type==='err'?S.notifErr:S.notifOk)}}>{notif.msg}</div>}

      {/* ── 로그인 모달 ── */}
      {modal==='login' && (
        <div style={S.overlay} onClick={closeModal}>
          <div style={S.card2} onClick={e=>e.stopPropagation()}>
            <div style={S.mIcon}>🪙</div>
            <h2 style={S.mTitle}>회원 로그인</h2>
            <p style={S.mSub}>이메일과 비밀번호로 로그인하세요</p>
            <Inp label="이메일" type="email" placeholder="your@email.com" value={loginEmail} onChange={v=>{setLoginEmail(v);setLoginErr('')}} onEnter={doLogin} />
            <Inp label="비밀번호" type="password" placeholder="비밀번호 입력" value={loginPw} onChange={v=>{setLoginPw(v);setLoginErr('')}} onEnter={doLogin} />
            {loginErr && <p style={S.errMsg}>{loginErr}</p>}
            <button style={S.btn} onClick={doLogin}>로그인</button>
            <button style={S.btnGhost} onClick={()=>{closeModal();setModal('register')}}>회원가입 →</button>
            <button style={S.btnLink} onClick={closeModal}>닫기</button>
          </div>
        </div>
      )}

      {/* ── 회원가입 모달 ── */}
      {modal==='register' && (
        <div style={S.overlay} onClick={closeModal}>
          <div style={S.card2} onClick={e=>e.stopPropagation()}>
            <div style={S.mIcon}>✍️</div>
            <h2 style={S.mTitle}>회원가입</h2>
            {regStep===1 ? (
              <>
                <p style={S.mSub}>이름과 이메일로 회원 DB를 조회합니다</p>
                <Inp label="이름" placeholder="홍길동" value={regName} onChange={v=>{setRegName(v);setRegErr('')}} onEnter={doRegSearch} />
                <Inp label="이메일" type="email" placeholder="your@email.com" value={regEmail} onChange={v=>{setRegEmail(v);setRegErr('')}} onEnter={doRegSearch} />
                {regErr && <p style={S.errMsg}>{regErr}</p>}
                <button style={S.btn} onClick={doRegSearch}>조회하기</button>
              </>
            ) : (
              <>
                <div style={{background:'rgba(5,150,105,0.12)',border:'1px solid rgba(5,150,105,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13}}>
                  ✅ 확인됨: <strong>{regFound?.name}</strong> ({regFound?.team} · {regFound?.part})
                </div>
                <p style={S.mSub}>사용할 비밀번호를 설정하세요 (4자 이상)</p>
                <Inp label="비밀번호" type="password" placeholder="4자 이상" value={regPw} onChange={v=>{setRegPw(v);setRegErr('')}} />
                <Inp label="비밀번호 확인" type="password" placeholder="동일하게 입력" value={regPw2} onChange={v=>{setRegPw2(v);setRegErr('')}} onEnter={doRegComplete} />
                {regErr && <p style={S.errMsg}>{regErr}</p>}
                <button style={S.btn} onClick={doRegComplete}>가입 완료</button>
                <button style={S.btnGhost} onClick={()=>setRegStep(1)}>← 뒤로</button>
              </>
            )}
            <button style={S.btnLink} onClick={closeModal}>닫기</button>
          </div>
        </div>
      )}

      {/* ── 관리자 로그인 ── */}
      {modal==='adminLogin' && (
        <div style={S.overlay} onClick={closeModal}>
          <div style={S.card2} onClick={e=>e.stopPropagation()}>
            <div style={S.mIcon}>🔑</div>
            <h2 style={{...S.mTitle,color:'#f87171'}}>관리자 로그인</h2>
            <Inp label="비밀번호" type="password" placeholder="관리자 비밀번호" value={adminPw} onChange={v=>{setAdminPw(v);setAdminPwErr(false)}} onEnter={doAdminLogin} error={adminPwErr?'비밀번호가 올바르지 않습니다.':''} />
            <button style={{...S.btn,background:'linear-gradient(135deg,#ef4444,#dc2626)'}} onClick={doAdminLogin}>로그인</button>
            <button style={S.btnLink} onClick={closeModal}>닫기</button>
          </div>
        </div>
      )}

      {/* ── 관리자 PW 변경 ── */}
      {modal==='adminChangePw' && (
        <div style={S.overlay} onClick={closeModal}>
          <div style={S.card2} onClick={e=>e.stopPropagation()}>
            <div style={S.mIcon}>🔑</div>
            <h2 style={{...S.mTitle,color:'#f87171'}}>관리자 비밀번호 변경</h2>
            <Inp label="현재 비밀번호" type="password" value={adminChgOld} onChange={v=>{setAdminChgOld(v);setAdminChgErr('')}} />
            <Inp label="새 비밀번호" type="password" placeholder="4자 이상" value={adminChgNew} onChange={v=>{setAdminChgNew(v);setAdminChgErr('')}} />
            <Inp label="새 비밀번호 확인" type="password" value={adminChgNew2} onChange={v=>{setAdminChgNew2(v);setAdminChgErr('')}} onEnter={doChangeAdminPw} />
            {adminChgErr && <p style={S.errMsg}>{adminChgErr}</p>}
            <button style={{...S.btn,background:'linear-gradient(135deg,#ef4444,#dc2626)'}} onClick={doChangeAdminPw}>변경하기</button>
            <button style={S.btnLink} onClick={closeModal}>취소</button>
          </div>
        </div>
      )}

      {/* ── 회원 PW 재설정 ── */}
      {modal==='resetPw' && (
        <div style={S.overlay} onClick={closeModal}>
          <div style={S.card2} onClick={e=>e.stopPropagation()}>
            <div style={S.mIcon}>🔒</div>
            <h2 style={S.mTitle}>비밀번호 재설정</h2>
            <p style={S.mSub}>{members.find(m=>m.id===resetId)?.name}님</p>
            <Inp label="새 비밀번호" type="password" placeholder="4자 이상" value={resetPw} onChange={setResetPw} onEnter={doResetPw} />
            <button style={S.btn} onClick={doResetPw}>변경하기</button>
            <button style={S.btnLink} onClick={closeModal}>취소</button>
          </div>
        </div>
      )}

      {/* ── 헤더 ── */}
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:24}}>🪙</span>
          <div>
            <div style={S.logoText}>감사 코인</div>
            <div style={S.logoSub}>{yr}년 {mo}월 · 마감 {lastDay}일</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {isAdmin ? (
            <><div style={S.adminBadge}>🔑 관리자</div><button style={S.chipBtn} onClick={logout}>로그아웃</button></>
          ) : currentUser ? (
            <><div style={S.coinChip}>{currentUser.avatar} <b style={{color:'#fbbf24',fontSize:13}}>{currentUser.name}</b> · 🪙 <b style={{color:'#fbbf24'}}>{myCoins}</b></div>
              <button style={{...S.chipBtn,background:'rgba(239,68,68,0.15)',borderColor:'rgba(239,68,68,0.3)',color:'#f87171'}} onClick={logout}>로그아웃</button></>
          ) : (
            <><button style={S.loginBtn} onClick={()=>setModal('login')}>로그인</button>
              <button style={S.regBtn}   onClick={()=>setModal('register')}>회원가입</button>
              <button style={S.adminBtn} onClick={()=>setModal('adminLogin')}>관리자</button></>
          )}
        </div>
      </header>

      {/* ── 네비 ── */}
      <nav style={S.nav}>
        {[{id:'home',l:'홈',ic:'🏠'},{id:'send',l:'보내기',ic:'🎁'},{id:'history',l:'내역',ic:'📋'},{id:'ranking',l:'랭킹',ic:'🏆'},{id:'admin',l:'설정',ic:'⚙️',adm:true}].map(t=>{
          const isActiveAdm = t.adm && (view==='admin' || view==='memberSettings')
          return (
          <button key={t.id}
            style={{...S.navBtn,...(isActiveAdm?S.navAdmActive:(view===t.id?S.navActive:{})),...(t.adm?{color:isActiveAdm?'#f87171':'#7f1d1d'}:{})}}
            onClick={()=>{
              if (t.adm) {
                if (isAdmin) { setView('admin'); return }
                if (currentUser) { setView('memberSettings'); return }
                return
              }
              setView(t.id)
            }}>            <span style={{fontSize:17}}>{t.ic}</span><span style={{fontSize:10}}>{t.l}</span>
          </button>
          )
        })}
      </nav>

      {/* ── 메인 ── */}
      <main style={S.main}>

        {/* 홈 */}
        {view==='home' && (
          <div style={S.sec}>
            {currentUser ? (
              <>
                <div style={S.welcomeCard}>
                  <span style={{fontSize:42}}>{currentUser.avatar}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:18,fontWeight:800,color:'#fbbf24'}}>{currentUser.name}님!</div>
                    <div style={{fontSize:12,color:'#78350f'}}>{currentUser.email}</div>
                    <div style={{fontSize:12,color:'#92400e',marginTop:2}}>{currentUser.team} · {currentUser.part}</div>
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'flex-end'}}>
                    {[...Array(Math.max(myCoins,3))].map((_,i)=><span key={i} style={{fontSize:24,opacity:i<myCoins?1:0.15}}>🪙</span>)}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  {[{n:mySent.length,l:'보낸 코인'},{n:myReceived.length,l:'받은 코인'},{n:myCoins,l:'남은 코인',gold:true}].map(s=>(
                    <div key={s.l} style={S.statCard}><div style={{fontSize:26,fontWeight:900,color:s.gold?'#fbbf24':'#fef3c7',lineHeight:1}}>{s.n}</div><div style={{fontSize:11,color:'#92400e',marginTop:5,fontWeight:600}}>{s.l}</div></div>
                  ))}
                </div>
                {!isDistributed && <div style={S.warnBanner}>⏳ 이번 달 코인이 아직 지급되지 않았습니다.</div>}
                {myReceived.length>0 && (
                  <div style={S.card}><h3 style={S.cTitle}>💌 받은 감사 메세지</h3>
                    {myReceived.map(tx=>{const f=members.find(m=>m.id===tx.fromId);return(<div key={tx.id} style={S.txItem}><span style={{fontSize:20}}>{f?.avatar}</span><div style={{flex:1}}><div style={S.txFrom}>{f?.name}</div><div style={S.txMsg}>"{tx.message}"</div><div style={S.txDate}>{fmtDate(tx.date)}</div></div><span>🪙</span></div>)})}
                  </div>
                )}
                <button style={S.btn} onClick={()=>setView('send')}>🎁 감사 코인 보내기</button>
              </>
            ) : (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',padding:'32px 16px',gap:16}}>
                <div style={{fontSize:72}}>🪙</div>
                <h1 style={{margin:0,fontSize:32,fontWeight:900,color:'#fbbf24'}}>감사 코인</h1>
                <p style={{color:'#d97706',lineHeight:1.8,fontSize:15,margin:0}}>동료에게 감사한 마음을 코인으로 전달하세요.<br/>관리자가 매월 코인을 수동 지급합니다.</p>
                <div style={{display:'flex',gap:10,marginTop:8}}>
                  <button style={S.btn} onClick={()=>setModal('login')}>로그인</button>
                  <button style={{...S.btn,background:'rgba(251,191,36,0.15)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.3)'}} onClick={()=>setModal('register')}>회원가입</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 보내기 */}
        {view==='send' && (
          <div style={S.sec}>
            <h2 style={S.pTitle}>🎁 코인 보내기</h2>
            {!currentUser
              ? <div style={S.center}><button style={{...S.btn,width:'auto',padding:'10px 28px'}} onClick={()=>setModal('login')}>로그인</button></div>
              : myCoins<=0
                ? <div style={{...S.center,color:'#78350f'}}><div style={{fontSize:48}}>😔</div><p>이번 달 사용 가능한 코인이 없습니다.</p></div>
                : <div style={S.card}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,padding:'10px 12px',background:'rgba(251,191,36,0.07)',borderRadius:10}}>
                      <span style={{fontSize:13,fontWeight:600}}>사용 가능한 코인</span>
                      <span style={{display:'flex',gap:4,fontSize:20}}>{[...Array(myCoins)].map((_,i)=><span key={i}>🪙</span>)}</span>
                    </div>
                    <label style={S.lbl}>받을 회원</label>
                    <select style={S.sel} value={sendTo} onChange={e=>setSendTo(e.target.value)}>
                      <option value="">선택해주세요</option>
                      {regMembers.filter(m=>m.id!==currentUser.id).map(m=>(
                        <option key={m.id} value={m.id}>{m.avatar} {m.name} ({m.team} · {m.part})</option>
                      ))}
                    </select>
                    <label style={{...S.lbl,marginTop:12}}>감사 메세지</label>
                    <textarea style={S.ta} value={sendMsg} onChange={e=>setSendMsg(e.target.value)} placeholder="감사한 이유를 적어주세요..." rows={4} />
                    <button style={{...S.btn,marginTop:4}} onClick={sendCoin}>🪙 코인 전달하기</button>
                  </div>
            }
          </div>
        )}

        {/* 내역 */}
        {view==='history' && (
          <div style={S.sec}>
            <h2 style={S.pTitle}>📋 이번 달 내역</h2>
            {!currentUser
              ? <div style={S.center}><button style={{...S.btn,width:'auto',padding:'10px 28px'}} onClick={()=>setModal('login')}>로그인</button></div>
              : <>
                  <div style={S.card}><h3 style={S.cTitle}>💌 받은 코인 ({myReceived.length})</h3>
                    {myReceived.length===0 ? <p style={{color:'#78350f',fontSize:13}}>아직 없습니다</p>
                      : myReceived.map(tx=>{const f=members.find(m=>m.id===tx.fromId);return(<div key={tx.id} style={S.txItem}><span style={{fontSize:20}}>{f?.avatar}</span><div style={{flex:1}}><div style={S.txFrom}>{f?.name}님으로부터</div><div style={S.txMsg}>"{tx.message}"</div><div style={S.txDate}>{fmtDate(tx.date)}</div></div><span>🪙</span></div>)})}
                  </div>
                  <div style={S.card}><h3 style={S.cTitle}>🎁 보낸 코인 ({mySent.length})</h3>
                    {mySent.length===0 ? <p style={{color:'#78350f',fontSize:13}}>아직 없습니다</p>
                      : mySent.map(tx=>{const t2=members.find(m=>m.id===tx.toId);return(<div key={tx.id} style={S.txItem}><span style={{fontSize:20}}>{t2?.avatar}</span><div style={{flex:1}}><div style={S.txFrom}>{t2?.name}님에게</div><div style={S.txMsg}>"{tx.message}"</div><div style={S.txDate}>{fmtDate(tx.date)}</div></div><span>🪙</span></div>)})}
                  </div>
                </>
            }
          </div>
        )}

        {/* 랭킹 */}
        {view==='ranking' && (
          <div style={S.sec}>
            <h2 style={S.pTitle}>🏆 {mo}월 랭킹</h2>
            {ranking.map((m,idx)=>(
              <div key={m.id} style={{...S.rankItem,...(idx===0?S.r1:idx===1?S.r2:idx===2?S.r3:{}),...(currentUser?.id===m.id?{boxShadow:'0 0 0 2px #f59e0b'}:{})}}>
                <div style={{fontSize:20,width:28,textAlign:'center'}}>{idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':idx+1}</div>
                <span style={{fontSize:22}}>{m.avatar}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14}}>{m.name}{currentUser?.id===m.id&&<span style={{color:'#fbbf24',fontSize:11}}> (나)</span>}</div>
                  <div style={{fontSize:11,color:'#78350f'}}>{m.team} · {m.part}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:3}}>
                  {m.received>0?[...Array(Math.min(m.received,5))].map((_,i)=><span key={i} style={{fontSize:14}}>🪙</span>):<span style={{color:'#4b2d0a'}}>-</span>}
                  <span style={{fontWeight:800,color:'#fbbf24',fontSize:13,marginLeft:3}}>{m.received}개</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 회원 설정 */}
        {view==='memberSettings' && (
          <div style={S.sec}>
            <h2 style={S.pTitle}>⚙️ 내 설정</h2>
            {!currentUser ? (
              <div style={S.center}>
                <p>로그인이 필요합니다.</p>
                <button style={{...S.btn,width:'auto',padding:'10px 28px'}} onClick={()=>setModal('login')}>로그인</button>
              </div>
            ) : (
              <div style={S.card}>
                <h3 style={{...S.cTitle,color:'#fbbf24'}}>🔑 비밀번호 변경</h3>
                <p style={{fontSize:12,color:'#92400e',margin:'0 0 16px'}}>현재 비밀번호를 확인한 후 새 비밀번호로 변경합니다.</p>
                <Inp label="현재 비밀번호" type="password" placeholder="현재 비밀번호 입력"
                  value={mbrChgOld} onChange={v=>{setMbrChgOld(v);setMbrChgErr('')}} />
                <Inp label="새 비밀번호" type="password" placeholder="4자 이상"
                  value={mbrChgNew} onChange={v=>{setMbrChgNew(v);setMbrChgErr('')}} />
                <Inp label="새 비밀번호 확인" type="password" placeholder="동일하게 입력"
                  value={mbrChgNew2} onChange={v=>{setMbrChgNew2(v);setMbrChgErr('')}} onEnter={doMemberChangePw} />
                {mbrChgErr && <p style={S.errMsg}>{mbrChgErr}</p>}
                <button style={S.btn} onClick={doMemberChangePw}>🔑 비밀번호 변경하기</button>
              </div>
            )}
          </div>
        )}

        {/* 관리자 */}
        {view==='admin' && (
          <div style={S.sec}>
            {!isAdmin ? (
              <div style={S.center}><div style={{fontSize:48}}>🔑</div><p style={{color:'#f87171'}}>관리자만 접근 가능합니다.</p>
                <button style={{...S.btn,background:'linear-gradient(135deg,#ef4444,#dc2626)',width:'auto',padding:'11px 28px'}} onClick={()=>setModal('adminLogin')}>관리자 로그인</button>
              </div>
            ) : (
              <>
                <h2 style={{...S.pTitle,color:'#f87171'}}>⚙️ 관리자 패널</h2>
                <div style={{display:'flex',background:'rgba(0,0,0,0.2)',borderRadius:12,padding:4,gap:4,overflowX:'auto'}}>
                  {[{id:'coins',l:'🪙 코인'},{id:'members',l:'👥 회원'},{id:'txHistory',l:'📋 이력'},{id:'stats',l:'📊 통계'},{id:'settings',l:'⚙️ 설정'}].map(t=>(
                    <button key={t.id} style={{flex:'0 0 auto',padding:'9px 12px',border:'none',borderRadius:9,fontWeight:700,fontSize:12,cursor:'pointer',background:adminTab===t.id?'rgba(251,191,36,0.2)':'transparent',color:adminTab===t.id?'#fbbf24':'#78350f',whiteSpace:'nowrap'}}
                      onClick={()=>setAdminTab(t.id)}>{t.l}</button>
                  ))}
                </div>

                {/* ── 코인 탭 ── */}
                {adminTab==='coins' && (
                  <>
                    <div style={{...S.card,border:'1px solid rgba(239,68,68,0.25)'}}>
                      <h3 style={{...S.cTitle,color:'#f87171'}}>🪙 일괄 코인 지급</h3>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                        <div><label style={S.lbl}>지급 월</label><input type="month" style={{...S.inp,boxSizing:'border-box'}} value={distMonth} onChange={e=>setDistMonth(e.target.value)} /></div>
                        <div><label style={S.lbl}>기본 코인 수</label>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <input type="number" min={1} max={99} style={{...S.inp,textAlign:'center',fontSize:20,fontWeight:800,color:'#fbbf24',boxSizing:'border-box'}} value={bulkDefault} onChange={e=>{const v=e.target.value; setBulkDefault(v===''?'':Math.max(1,Number(v)))}} onBlur={e=>{if(e.target.value===''||Number(e.target.value)<1) setBulkDefault(1)}} />
                            <span style={{color:'#92400e',fontSize:13}}>개</span>
                          </div>
                        </div>
                      </div>
                      {distributed[distMonth]
                        ? <div style={S.okBanner}>✅ {distMonth} 완료 (기본 {distributed[distMonth].defaultAmt}개)</div>
                        : <div style={{...S.warnBanner,marginBottom:12}}>⏳ {distMonth} 아직 지급 전</div>}
                      <div style={{maxHeight:280,overflowY:'auto'}}>
                        {regMembers.map(m=>(
                          <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                            <span style={{fontSize:18}}>{m.avatar}</span>
                            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13}}>{m.name}</div><div style={{fontSize:10,color:'#78350f',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.team} · {m.part}</div></div>
                            <span style={{fontSize:11,color:'#92400e',whiteSpace:'nowrap'}}>현재 {getCoins(m.id,distMonth)}개</span>
                            <input type="number" min={0} max={99} placeholder={String(bulkDefault)}
                              style={{width:50,textAlign:'center',padding:'4px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:8,color:'#fef3c7',fontSize:13}}
                              value={customCoins[m.id]??''} onChange={e=>setCustomCoins({...customCoins,[m.id]:e.target.value})} />
                          </div>
                        ))}
                        {regMembers.length===0 && <p style={{color:'#78350f',fontSize:13}}>가입 완료된 회원이 없습니다.</p>}
                      </div>
                      <button style={{...S.btn,marginTop:14,...(distributed[distMonth]?{background:'rgba(107,114,128,0.3)',cursor:'not-allowed'}:{})}}
                        onClick={distributeAll} disabled={!!distributed[distMonth]}>
                        {distributed[distMonth]?'✅ 이미 지급 완료':`🪙 ${distMonth} 일괄 지급 (기본 ${bulkDefault}개)`}
                      </button>
                    </div>
                    <div style={S.card}>
                      <h3 style={S.cTitle}>➕ 개별 추가 지급</h3>
                      {regMembers.map(m=><IndividualRow key={m.id} member={m} currentCoins={getCoins(m.id,distMonth)} onGive={giveOne} />)}
                      {regMembers.length===0 && <p style={{color:'#78350f',fontSize:13}}>가입 완료된 회원이 없습니다.</p>}
                    </div>
                  </>
                )}

                {/* ── 회원 탭 ── */}
                {adminTab==='members' && (
                  <>
                    <div style={S.card}>
                      <h3 style={S.cTitle}>📂 Excel 가져오기 / 내보내기</h3>
                      <p style={{fontSize:12,color:'#92400e',margin:'0 0 10px'}}>열 순서: 이름 · 이메일 · 팀 · 파트</p>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
                        <input type="text" readOnly placeholder="파일을 선택해주세요..." value={excelFileName}
                          style={{...S.inp,flex:1,cursor:'pointer',color:excelFileName?'#fef3c7':'#78350f',fontSize:13}}
                          onClick={()=>document.getElementById('excelInput').click()} />
                        <label htmlFor="excelInput" style={{flexShrink:0,cursor:'pointer',background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.3)',color:'#93c5fd',padding:'10px 14px',borderRadius:9,fontSize:13,fontWeight:700,whiteSpace:'nowrap'}}>📁 찾아보기</label>
                        <input id="excelInput" type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>{if(e.target.files[0])setExcelFileName(e.target.files[0].name);handleExcelImport(e)}} />
                      </div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        <button style={{...S.chipBtn,background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)',color:'#86efac',padding:'8px 14px',borderRadius:9,fontSize:13,fontWeight:700}} onClick={downloadTemplate}>📋 양식 다운로드</button>
                        <button style={{...S.chipBtn,background:'rgba(251,191,36,0.15)',border:'1px solid rgba(251,191,36,0.3)',color:'#fbbf24',padding:'8px 14px',borderRadius:9,fontSize:13,fontWeight:700}} onClick={exportDB}>📤 회원 내보내기</button>
                      </div>
                    </div>
                    <div style={S.card}>
                      <h3 style={S.cTitle}>➕ 신규 회원 추가</h3>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        <div><label style={S.lbl}>이름</label><input style={S.inp} placeholder="홍길동" value={newMbr.name} onChange={e=>setNewMbr({...newMbr,name:e.target.value})} /></div>
                        <div><label style={S.lbl}>이메일</label><input style={S.inp} type="email" placeholder="hong@co.com" value={newMbr.email} onChange={e=>setNewMbr({...newMbr,email:e.target.value})} /></div>
                        <div><label style={S.lbl}>팀</label><input style={S.inp} placeholder="개발팀" value={newMbr.team} onChange={e=>setNewMbr({...newMbr,team:e.target.value})} /></div>
                        <div><label style={S.lbl}>파트</label><input style={S.inp} placeholder="프론트엔드" value={newMbr.part} onChange={e=>setNewMbr({...newMbr,part:e.target.value})} onKeyDown={e=>e.key==='Enter'&&addMember()} /></div>
                      </div>
                      {newMbrErr && <p style={S.errMsg}>{newMbrErr}</p>}
                      <button style={{...S.btn,marginTop:10}} onClick={addMember}>회원 추가</button>
                    </div>
                    <div style={S.card}>
                      <h3 style={S.cTitle}>전체 회원 ({members.length}명 / 가입완료 {regMembers.length}명)</h3>
                      <div style={{maxHeight:400,overflowY:'auto'}}>
                        {members.map(m=>(
                          <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.05)',flexWrap:'wrap'}}>
                            <span style={{fontSize:20}}>{m.avatar}</span>
                            <div style={{flex:1,minWidth:120}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                                <span style={{fontWeight:700,fontSize:14}}>{m.name}</span>
                                {m.locked||(m.failedAttempts??0)>=MAX_FAIL
                                  ? <span style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:6,padding:'1px 6px',fontSize:10,color:'#f87171'}}>🔒 잠김</span>
                                  : m.password
                                    ? <span style={{background:'rgba(5,150,105,0.15)',border:'1px solid rgba(5,150,105,0.3)',borderRadius:6,padding:'1px 6px',fontSize:10,color:'#6ee7b7'}}>✅ 가입</span>
                                    : <span style={{background:'rgba(107,114,128,0.2)',border:'1px solid rgba(107,114,128,0.3)',borderRadius:6,padding:'1px 6px',fontSize:10,color:'#9ca3af'}}>미가입</span>}
                              </div>
                              <div style={{fontSize:11,color:'#78350f'}}>{m.email}</div>
                              <div style={{fontSize:11,color:'#92400e'}}>{m.team} · {m.part}</div>
                            </div>
                            <div style={{display:'flex',gap:6,flexShrink:0}}>
                              {(m.locked||(m.failedAttempts??0)>=MAX_FAIL)&&<button style={{background:'rgba(251,191,36,0.15)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:8,padding:'4px 9px',color:'#fbbf24',cursor:'pointer',fontSize:11,fontWeight:700}} onClick={()=>unlockMember(m.id)}>🔓 잠금해제</button>}
                              {m.password&&<button style={{background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:8,padding:'4px 9px',color:'#93c5fd',cursor:'pointer',fontSize:11}} onClick={()=>{setResetId(m.id);setResetPw('');setModal('resetPw')}}>🔒 PW재설정</button>}
                              <button style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'4px 9px',color:'#f87171',cursor:'pointer',fontSize:11}} onClick={()=>removeMember(m.id)}>삭제</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── 이력 탭 ── */}
                {adminTab==='txHistory' && (
                  <HistoryTab transactions={transactions} members={members} onExport={exportHistory} />
                )}

                {/* ── 통계 탭 ── */}
                {adminTab==='stats' && (
                  <div style={S.card}>
                    <h3 style={S.cTitle}>📊 이번 달 통계 ({mo}월)</h3>
                    {[
                      ['회원 DB 총 인원',`${members.length}명`],
                      ['가입 완료',`${regMembers.length}명`],
                      ['미가입',`${members.length-regMembers.length}명`],
                      ['잠긴 계정',`${members.filter(m=>m.locked||(m.failedAttempts??0)>=MAX_FAIL).length}개`,'#f87171'],
                      ['총 거래 수',`${transactions.filter(t=>t.month===cm).length}건`],
                      ['잔여 코인',`${regMembers.reduce((s,m)=>s+getCoins(m.id,cm),0)}개`],
                      ['이번 달 지급',isDistributed?`✅ 기본 ${distributed[cm]?.defaultAmt}개`:'❌ 미지급',isDistributed?'#6ee7b7':'#f87171'],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:14}}>
                        <span style={{color:'#d4c4a0'}}>{l}</span><strong style={c?{color:c}:{}}>{v}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── 설정 탭 ── */}
                {adminTab==='settings' && (
                  <div style={S.card}>
                    <h3 style={{...S.cTitle,color:'#f87171'}}>🔑 관리자 비밀번호 변경</h3>
                    <p style={{fontSize:12,color:'#92400e',margin:'0 0 14px'}}>현재 비밀번호를 확인한 후 새 비밀번호로 변경합니다.</p>
                    <button style={{...S.btn,background:'linear-gradient(135deg,#ef4444,#dc2626)'}} onClick={()=>setModal('adminChangePw')}>🔑 비밀번호 변경하기</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────
const S = {
  app:{minHeight:'100vh',background:'linear-gradient(135deg,#1a0a00 0%,#2d1500 50%,#1a0a00 100%)',color:'#fef3c7',fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",position:'relative'},
  orb1:{position:'fixed',top:-100,right:-100,width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(251,191,36,0.1) 0%,transparent 70%)',pointerEvents:'none'},
  orb2:{position:'fixed',bottom:-100,left:-100,width:280,height:280,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,158,11,0.07) 0%,transparent 70%)',pointerEvents:'none'},
  loading:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#1a0a00',gap:16},
  syncBadge:{position:'fixed',bottom:16,right:16,background:'rgba(59,130,246,0.2)',border:'1px solid rgba(59,130,246,0.4)',borderRadius:20,padding:'6px 14px',color:'#93c5fd',fontSize:12,fontWeight:600,zIndex:999},
  notif:{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',padding:'11px 22px',borderRadius:12,fontWeight:600,zIndex:1000,boxShadow:'0 4px 20px rgba(0,0,0,0.4)',whiteSpace:'nowrap',maxWidth:'90vw',textAlign:'center'},
  notifOk:{background:'#065f46',color:'#6ee7b7',border:'1px solid #059669'},
  notifErr:{background:'#7f1d1d',color:'#fca5a5',border:'1px solid #dc2626'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16},
  card2:{background:'#1f0e00',border:'1px solid rgba(251,191,36,0.2)',borderRadius:22,padding:28,width:'100%',maxWidth:370,boxShadow:'0 24px 60px rgba(0,0,0,0.6)'},
  mIcon:{fontSize:44,textAlign:'center',marginBottom:6},
  mTitle:{margin:'0 0 3px',fontSize:21,fontWeight:900,color:'#fbbf24',textAlign:'center'},
  mSub:{margin:'0 0 16px',color:'#92400e',fontSize:13,textAlign:'center'},
  header:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',borderBottom:'1px solid rgba(251,191,36,0.1)',background:'rgba(0,0,0,0.35)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:100,flexWrap:'wrap',gap:8},
  logoText:{fontSize:16,fontWeight:800,color:'#fbbf24'},
  logoSub:{fontSize:10,color:'#92400e'},
  coinChip:{display:'flex',alignItems:'center',gap:5,background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.22)',borderRadius:20,padding:'4px 11px',fontSize:14},
  adminBadge:{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:20,padding:'5px 13px',color:'#f87171',fontWeight:700,fontSize:13},
  chipBtn:{display:'flex',alignItems:'center',gap:5,background:'transparent',border:'1px solid rgba(251,191,36,0.18)',borderRadius:20,padding:'5px 12px',color:'#fef3c7',cursor:'pointer',fontSize:13,fontWeight:600},
  loginBtn:{background:'linear-gradient(135deg,#f59e0b,#d97706)',border:'none',borderRadius:18,padding:'6px 16px',color:'#1a0a00',fontWeight:700,cursor:'pointer',fontSize:13},
  regBtn:{background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:18,padding:'6px 14px',color:'#fbbf24',fontWeight:700,cursor:'pointer',fontSize:13},
  adminBtn:{background:'rgba(239,68,68,0.13)',border:'1px solid rgba(239,68,68,0.22)',borderRadius:18,padding:'6px 13px',color:'#f87171',fontWeight:700,cursor:'pointer',fontSize:13},
  nav:{display:'flex',borderBottom:'1px solid rgba(251,191,36,0.07)',background:'rgba(0,0,0,0.18)',overflowX:'auto'},
  navBtn:{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'9px 0',background:'transparent',border:'none',color:'#78350f',cursor:'pointer',fontWeight:600,flex:1,minWidth:56},
  navActive:{color:'#fbbf24',borderBottom:'2px solid #fbbf24'},
  navAdmActive:{color:'#f87171',borderBottom:'2px solid #ef4444'},
  main:{maxWidth:620,margin:'0 auto',padding:'18px 14px',minHeight:'calc(100vh - 108px)'},
  sec:{display:'flex',flexDirection:'column',gap:15},
  pTitle:{margin:0,fontSize:21,fontWeight:800,color:'#fbbf24'},
  card:{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(251,191,36,0.11)',borderRadius:18,padding:18},
  cTitle:{margin:'0 0 13px',fontSize:14,fontWeight:700,color:'#fbbf24'},
  welcomeCard:{background:'linear-gradient(135deg,rgba(251,191,36,0.1),rgba(245,158,11,0.05))',border:'1px solid rgba(251,191,36,0.22)',borderRadius:18,padding:'16px 18px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'},
  statCard:{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(251,191,36,0.1)',borderRadius:13,padding:'13px 10px',textAlign:'center'},
  txItem:{display:'flex',alignItems:'flex-start',gap:10,padding:'11px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'},
  txFrom:{fontSize:13,fontWeight:700,color:'#fef3c7'},
  txMsg:{fontSize:13,color:'#d97706',fontStyle:'italic',margin:'3px 0'},
  txDate:{fontSize:11,color:'#78350f'},
  lbl:{display:'block',fontSize:12,fontWeight:700,color:'#fbbf24',marginBottom:5},
  inp:{width:'100%',padding:'10px 13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(251,191,36,0.18)',borderRadius:9,color:'#fef3c7',fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit'},
  sel:{width:'100%',padding:'10px 13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(251,191,36,0.18)',borderRadius:9,color:'#fef3c7',fontSize:14,outline:'none',boxSizing:'border-box',marginBottom:2},
  ta:{width:'100%',padding:'10px 13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(251,191,36,0.18)',borderRadius:9,color:'#fef3c7',fontSize:14,outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'},
  btn:{width:'100%',padding:'12px',background:'linear-gradient(135deg,#f59e0b,#d97706)',border:'none',borderRadius:11,color:'#1a0a00',fontWeight:800,fontSize:15,cursor:'pointer',marginTop:4},
  btnGhost:{width:'100%',padding:'10px',background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:11,color:'#fbbf24',cursor:'pointer',fontSize:13,fontWeight:600,marginTop:6},
  btnLink:{width:'100%',padding:'8px',background:'transparent',border:'none',color:'#78350f',cursor:'pointer',fontSize:12,marginTop:4},
  errMsg:{color:'#f87171',fontSize:12,margin:'0 0 8px',fontWeight:600},
  rankItem:{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(251,191,36,0.07)',borderRadius:13},
  r1:{background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.32)'},
  r2:{background:'rgba(156,163,175,0.07)',border:'1px solid rgba(156,163,175,0.22)'},
  r3:{background:'rgba(180,83,9,0.07)',border:'1px solid rgba(180,83,9,0.22)'},
  warnBanner:{background:'rgba(251,191,36,0.07)',border:'1px solid rgba(251,191,36,0.18)',borderRadius:10,padding:'10px 13px',fontSize:13,color:'#fbbf24'},
  okBanner:{background:'rgba(5,150,105,0.09)',border:'1px solid rgba(5,150,105,0.28)',borderRadius:10,padding:'10px 13px',fontSize:13,color:'#6ee7b7',marginBottom:8},
  center:{textAlign:'center',padding:'36px 20px',display:'flex',flexDirection:'column',gap:13,alignItems:'center',color:'#78350f'},
}
