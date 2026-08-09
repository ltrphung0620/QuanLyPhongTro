import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Headphones,
  Inbox,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  X
} from 'lucide-react'
import {
  guiTinNhanHoTro,
  layDanhSachHoiThoaiHoTro,
  layHoiThoaiHoTroCuaToi,
  layTinNhanHoTro
} from '../api'
import { useAuth } from '../context/AuthContext'
import './SupportChat.css'

const MESSAGE_PAGE_SIZE = 50
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function supportImageUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const cleanPath = path.replace(/^\//, '')
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '').replace(/\/api$/, '')
  return `${apiBase}/${cleanPath}`
}

function messageImageUrl(message) {
  return message.imageData || supportImageUrl(message.imagePath)
}

function parseUtcDate(value) {
  if (!value) return null
  if (value instanceof Date) return value

  // SQL Server trả DateTime không kèm múi giờ. Các mốc chat được lưu bằng UTC,
  // vì vậy cần gắn "Z" trước khi chuyển sang giờ Việt Nam.
  const normalized = typeof value === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
    ? `${value}Z`
    : value
  return new Date(normalized)
}

function vietnamDateKey(value) {
  const date = parseUtcDate(value)
  if (!date || Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function initials(value) {
  const parts = (value || 'AD').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase()
}

function formatConversationTime(value) {
  if (!value) return ''
  const date = parseUtcDate(value)
  const now = new Date()
  if (vietnamDateKey(date) === vietnamDateKey(now)) {
    return date.toLocaleTimeString('vi-VN', {
      timeZone: VIETNAM_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  return date.toLocaleDateString('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit'
  })
}

function formatMessageTime(value) {
  return parseUtcDate(value).toLocaleTimeString('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit'
  })
}

function messageDateLabel(value) {
  const date = parseUtcDate(value)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  if (vietnamDateKey(date) === vietnamDateKey(today)) return 'Hôm nay'
  if (vietnamDateKey(date) === vietnamDateKey(yesterday)) return 'Hôm qua'
  return date.toLocaleDateString('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export default function SupportChat() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SuperAdmin'
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [draft, setDraft] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [search, setSearch] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showMobileChat, setShowMobileChat] = useState(!isSuperAdmin)
  const messagesEndRef = useRef(null)
  const imageInputRef = useRef(null)

  const loadConversations = useCallback(async (keepSelection = true) => {
    if (!isSuperAdmin) return
    try {
      const data = await layDanhSachHoiThoaiHoTro()
      setConversations(data)
      setSelectedConversation((current) => {
        if (keepSelection && current) {
          return data.find((item) => item.supportConversationId === current.supportConversationId) || data[0] || null
        }
        return data[0] || null
      })
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách hội thoại.')
    } finally {
      setLoadingConversations(false)
    }
  }, [isSuperAdmin])

  useEffect(() => {
    if (isSuperAdmin) {
      loadConversations(false)
      return
    }

    let active = true
    async function loadAdminConversation() {
      try {
        const conversation = await layHoiThoaiHoTroCuaToi()
        if (active) setSelectedConversation(conversation)
      } catch (err) {
        if (active) setError(err.message || 'Không thể mở hội thoại hỗ trợ.')
      } finally {
        if (active) setLoadingConversations(false)
      }
    }
    loadAdminConversation()
    return () => { active = false }
  }, [isSuperAdmin, loadConversations])

  const loadMessages = useCallback(async (conversationId, scrollToBottom = true) => {
    if (!conversationId) return
    setLoadingMessages(true)
    try {
      const page = await layTinNhanHoTro(conversationId, null, MESSAGE_PAGE_SIZE)
      setMessages(page.items)
      setHasMore(page.hasMore)
      setError('')
      if (isSuperAdmin) {
        setConversations((items) => items.map((item) =>
          item.supportConversationId === conversationId
            ? { ...item, unreadCount: 0 }
            : item
        ))
      }
      if (scrollToBottom) {
        requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
      }
    } catch (err) {
      setError(err.message || 'Không thể tải tin nhắn.')
    } finally {
      setLoadingMessages(false)
    }
  }, [isSuperAdmin])

  useEffect(() => {
    if (selectedConversation?.supportConversationId) {
      loadMessages(selectedConversation.supportConversationId)
    } else {
      setMessages([])
    }
  }, [loadMessages, selectedConversation?.supportConversationId])

  useEffect(() => {
    const handleRealtime = (event) => {
      const payload = event.detail
      if (payload?.eventName !== 'support.message.created') return

      const conversationId = payload.data?.conversationId
      if (isSuperAdmin) loadConversations(true)
      if (conversationId === selectedConversation?.supportConversationId) {
        loadMessages(conversationId)
      }
    }

    window.addEventListener('realtime-event', handleRealtime)
    return () => window.removeEventListener('realtime-event', handleRealtime)
  }, [isSuperAdmin, loadConversations, loadMessages, selectedConversation?.supportConversationId])

  const filteredConversations = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN')
    if (!keyword) return conversations
    return conversations.filter((conversation) =>
      [conversation.adminName, conversation.adminEmail, ...(conversation.organizationNames || [])]
        .some((value) => value?.toLocaleLowerCase('vi-VN').includes(keyword))
    )
  }, [conversations, search])

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation)
    setShowMobileChat(true)
    setConversations((items) => items.map((item) =>
      item.supportConversationId === conversation.supportConversationId
        ? { ...item, unreadCount: 0 }
        : item
    ))
  }

  const loadOlderMessages = async () => {
    if (!selectedConversation || !messages.length || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await layTinNhanHoTro(
        selectedConversation.supportConversationId,
        messages[0].supportMessageId,
        MESSAGE_PAGE_SIZE
      )
      setMessages((current) => [...page.items, ...current])
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err.message || 'Không thể tải thêm tin nhắn.')
    } finally {
      setLoadingOlder(false)
    }
  }

  const sendMessage = async () => {
    const content = draft.trim()
    if ((!content && !selectedImage) || !selectedConversation || sending) return

    setSending(true)
    setDraft('')
    setSelectedImage(null)
    setError('')
    try {
      const message = await guiTinNhanHoTro(selectedConversation.supportConversationId, content, selectedImage)
      setMessages((current) => current.some((item) => item.supportMessageId === message.supportMessageId)
        ? current
        : [...current, message])
      if (isSuperAdmin) loadConversations(true)
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
    } catch (err) {
      setDraft(content)
      setSelectedImage(selectedImage)
      setError(err.message || 'Không thể gửi tin nhắn.')
    } finally {
      setSending(false)
    }
  }

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const selectImage = (event) => {
    const image = event.target.files?.[0]
    event.target.value = ''
    if (!image) return
    if (!image.type.startsWith('image/') || image.size > 5 * 1024 * 1024) {
      setError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP có dung lượng tối đa 5 MB.')
      return
    }
    setError('')
    setSelectedImage(image)
  }

  const conversationTitle = isSuperAdmin
    ? selectedConversation?.adminName
    : 'Super Admin'
  const conversationSubtitle = isSuperAdmin
    ? (selectedConversation?.organizationNames?.join(' · ') || selectedConversation?.adminEmail)
    : 'Bộ phận hỗ trợ hệ thống'

  let previousDate = ''

  return (
    <div className="page-body support-page">
      <div className={`support-shell ${isSuperAdmin ? 'super-admin-view' : 'admin-view'}`}>
        {isSuperAdmin && (
          <aside className={`support-inbox ${showMobileChat ? 'mobile-hidden' : ''}`}>
            <div className="support-inbox-header">
              <div>
                <span className="support-eyebrow">Trung tâm hỗ trợ</span>
                <h2>Tin nhắn</h2>
              </div>
              <span className="support-thread-count">{conversations.length}</span>
            </div>

            <div className="support-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm Admin hoặc dãy trọ"
                aria-label="Tìm hội thoại hỗ trợ"
              />
            </div>

            <div className="support-thread-list">
              {loadingConversations ? (
                <div className="support-list-state"><LoaderCircle className="spin" size={22} /> Đang tải hội thoại...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="support-list-empty">
                  <Inbox size={30} />
                  <strong>Chưa có tin nhắn</strong>
                  <span>Các yêu cầu từ Admin sẽ xuất hiện tại đây.</span>
                </div>
              ) : filteredConversations.map((conversation) => (
                <button
                  key={conversation.supportConversationId}
                  className={`support-thread ${selectedConversation?.supportConversationId === conversation.supportConversationId ? 'active' : ''}`}
                  onClick={() => selectConversation(conversation)}
                >
                  <span className="support-avatar">{initials(conversation.adminName)}</span>
                  <span className="support-thread-body">
                    <span className="support-thread-row">
                      <strong>{conversation.adminName}</strong>
                      <time>{formatConversationTime(conversation.lastMessageAt)}</time>
                    </span>
                    <span className="support-thread-org">{conversation.organizationNames?.join(' · ') || conversation.adminEmail}</span>
                    <span className="support-thread-row">
                      <span className="support-thread-preview">{conversation.lastMessage || 'Hội thoại hỗ trợ mới'}</span>
                      {conversation.unreadCount > 0 && <b className="support-unread">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</b>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </aside>
        )}

        <section className={`support-chat ${isSuperAdmin && !showMobileChat ? 'mobile-hidden' : ''}`}>
          {!selectedConversation ? (
            <div className="support-chat-empty">
              <span><MessageCircle size={34} /></span>
              <h3>Chọn một hội thoại</h3>
              <p>Chọn Admin ở danh sách bên trái để xem và trả lời yêu cầu hỗ trợ.</p>
            </div>
          ) : (
            <>
              <header className="support-chat-header">
                {isSuperAdmin && (
                  <button className="support-back-button" onClick={() => setShowMobileChat(false)} aria-label="Quay lại danh sách hội thoại">
                    <ArrowLeft size={20} />
                  </button>
                )}
                <span className={`support-avatar ${isSuperAdmin ? '' : 'super'}`}>
                  {isSuperAdmin ? initials(conversationTitle) : <ShieldCheck size={21} />}
                </span>
                <div className="support-chat-person">
                  <strong>{conversationTitle}</strong>
                  <span>{conversationSubtitle}</span>
                </div>
                <div className="support-private-label"><Headphones size={15} /> Hội thoại riêng tư</div>
              </header>

              <div className="support-message-area">
                {hasMore && (
                  <button className="support-load-more" onClick={loadOlderMessages} disabled={loadingOlder}>
                    {loadingOlder ? 'Đang tải...' : 'Xem tin nhắn cũ hơn'}
                  </button>
                )}

                {loadingMessages && messages.length === 0 ? (
                  <div className="support-message-loading"><LoaderCircle className="spin" size={24} /></div>
                ) : messages.length === 0 ? (
                  <div className="support-welcome">
                    <span><Headphones size={27} /></span>
                    <strong>{isSuperAdmin ? 'Hội thoại hỗ trợ mới' : 'Bạn cần Super Admin hỗ trợ?'}</strong>
                    <p>{isSuperAdmin ? 'Hãy gửi lời chào và bắt đầu hỗ trợ Admin này.' : 'Hãy mô tả vấn đề bạn đang gặp. Super Admin sẽ phản hồi trong hội thoại này.'}</p>
                  </div>
                ) : messages.map((message) => {
                  const dateLabel = messageDateLabel(message.sentAt)
                  const showDate = dateLabel !== previousDate
                  previousDate = dateLabel
                  const outgoing = isSuperAdmin ? message.senderRole === 'SuperAdmin' : message.isMine
                  return (
                    <div key={message.supportMessageId}>
                      {showDate && <div className="support-date-divider"><span>{dateLabel}</span></div>}
                      <div className={`support-message-row ${outgoing ? 'outgoing' : 'incoming'}`}>
                        {!outgoing && <span className={`support-message-avatar ${message.senderRole === 'SuperAdmin' ? 'super' : ''}`}>{message.senderRole === 'SuperAdmin' ? <ShieldCheck size={15} /> : initials(message.senderName)}</span>}
                        <div className="support-message-block">
                          {!outgoing && <span className="support-sender-name">{message.senderName}</span>}
                          {message.content && <div className="support-bubble">{message.content}</div>}
                          {(message.imageData || message.imagePath) && (
                            <a className="support-message-image" href={messageImageUrl(message)} target="_blank" rel="noreferrer">
                              <img src={messageImageUrl(message)} alt="Ảnh đính kèm" />
                            </a>
                          )}
                          <time>{formatMessageTime(message.sentAt)}</time>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <footer className="support-composer">
                {error && <div className="support-error">{error}</div>}
                {selectedImage && (
                  <div className="support-image-draft">
                    <ImagePlus size={15} />
                    <span>{selectedImage.name}</span>
                    <button type="button" onClick={() => setSelectedImage(null)} aria-label="Bỏ ảnh đính kèm"><X size={15} /></button>
                  </div>
                )}
                <div className="support-composer-box">
                  <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} hidden />
                  <button type="button" className="support-attach-button" onClick={() => imageInputRef.current?.click()} disabled={sending} aria-label="Đính kèm ảnh">
                    <ImagePlus size={19} />
                  </button>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={isSuperAdmin ? 'Nhập câu trả lời cho Admin...' : 'Nhập nội dung cần hỗ trợ...'}
                    aria-label="Nội dung tin nhắn hỗ trợ"
                    rows={1}
                  />
                  {draft.length > 1800 && <span className="support-character-count">{draft.length}/2000</span>}
                  <button className="support-send-button" onClick={sendMessage} disabled={(!draft.trim() && !selectedImage) || sending} aria-label="Gửi tin nhắn">
                    {sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}
                  </button>
                </div>
                <span className="support-composer-hint">Enter để gửi · Shift + Enter để xuống dòng</span>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
