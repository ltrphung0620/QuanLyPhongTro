import React, { useState, useEffect, useRef } from 'react'
import { Bot, Send, Loader2, Check, MessageSquare, Sparkles, HelpCircle, ArrowRight, Zap, Info, Calendar } from 'lucide-react'
import { guiTinNhanAssistant, thucThiLenhAssistant } from '../api'
import { useNotification } from '../context/NotificationContext'
import './Assistant.css'

const GOI_Y_CHI_TIET = [
  { text: 'Nhập số điện tháng 10 phòng A1 là 1000', label: 'Nhập nhanh số điện nước' },
  { text: 'Phòng nào còn trống?', label: 'Tìm phòng trống' },
  { text: 'Hóa đơn nào chưa thanh toán tháng 10?', label: 'Xem hóa đơn chưa thanh toán' },
  { text: 'Tính tiền phòng A1 tháng 10', label: 'Tạo hóa đơn cho phòng' },
  { text: 'Doanh thu tháng này là bao nhiêu?', label: 'Xem tổng doanh thu' }
]

function taoTinNhan(role, text, data = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    ...data
  }
}

export default function Assistant() {
  const { toast } = useNotification()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([
    taoTinNhan('assistant', 'Chào bạn! Mình là Trợ lý AI. Mình có thể giúp bạn cập nhật chỉ số điện nước, kiểm tra phòng trống hoặc truy vấn nhanh hóa đơn trọ. Bạn cần hỗ trợ việc gì hôm nay?')
  ])

  const messagesEndRef = useRef(null)

  // Scroll to bottom whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const guiTinNhan = async (text = input) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setInput('')
    setMessages((items) => [...items, taoTinNhan('user', trimmed)])
    setLoading(true)

    try {
      const response = await guiTinNhanAssistant(trimmed)
      setMessages((items) => [
        ...items,
        taoTinNhan('assistant', response.message || 'Mình đã xử lý yêu cầu.', {
          commandId: response.commandId,
          type: response.type,
          preview: response.preview,
          pendingCommand: response.pendingCommand,
          suggestions: response.suggestions || []
        })
      ])
    } catch (error) {
      toast.error(error.message || 'Có lỗi khi kết nối với máy chủ trợ lý.')
      setMessages((items) => [...items, taoTinNhan('assistant', error.message || 'Có lỗi khi xử lý yêu cầu.')])
    } finally {
      setLoading(false)
    }
  }

  const xacNhanLenh = async (commandId) => {
    if (!commandId || loading) return
    setLoading(true)

    try {
      const response = await thucThiLenhAssistant(commandId)
      toast.success(response.message || 'Thực hiện lệnh thành công!')
      setMessages((items) => [
        ...items,
        taoTinNhan('assistant', response.message || 'Đã thực hiện xong.', {
          type: response.type,
          result: response.result
        })
      ])
    } catch (error) {
      toast.error(error.message || 'Không thể thực hiện lệnh.')
      setMessages((items) => [...items, taoTinNhan('assistant', error.message || 'Không thể thực hiện lệnh.')])
    } finally {
      setLoading(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    guiTinNhan()
  }

  return (
    <div className="page-body">
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <span className="page-eyebrow">Trí tuệ nhân tạo</span>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot className="text-accent" size={26} />
            Trợ Lý AI
          </h1>
        </div>
      </header>

      <div className="assistant-page-container">
        {/* Left Column: Chat Area */}
        <div className="assistant-chat-card">
          <div className="assistant-chat-header">
            <Bot size={20} className="text-accent" />
            <h3>Hội thoại với Trợ lý</h3>
            <div className="status-indicator" style={{ marginLeft: 'auto' }}>
              <div className="status-dot"></div>
              Hệ thống sẵn sàng
            </div>
          </div>

          <div className="chat-messages-container">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`chat-message-bubble chat-message-bubble--${message.role}`}
              >
                <p>{message.text}</p>
                
                {message.type === 'confirmation_required' && message.commandId && (
                  <div className="chat-message-actions">
                    <button 
                      type="button" 
                      className="assistant-confirm-btn" 
                      onClick={() => xacNhanLenh(message.commandId)} 
                      disabled={loading}
                    >
                      <Check size={16} />
                      Xác nhận thực hiện lệnh
                    </button>
                  </div>
                )}

                {message.suggestions?.length > 0 && (
                  <div className="assistant-inline-suggestions">
                    {message.suggestions.map((suggestion) => (
                      <button 
                        key={suggestion} 
                        type="button" 
                        onClick={() => guiTinNhan(suggestion)} 
                        disabled={loading}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="chat-message-bubble chat-message-bubble--assistant">
                <div className="chat-loading-bubble">
                  <Loader2 size={16} />
                  <span>Đang phân tích cú pháp lệnh...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <form className="chat-input-form" onSubmit={submit}>
              <input
                className="chat-input-field"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Nhập yêu cầu bằng tiếng Việt (ví dụ: số điện A1 tháng này là 1024)..."
                disabled={loading}
              />
              <button 
                type="submit" 
                className="chat-send-btn" 
                disabled={loading || !input.trim()}
                aria-label="Gửi yêu cầu"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Information & Help Panel */}
        <div className="assistant-sidebar-column">
          <div className="assistant-info-box">
            <h3>
              <Sparkles size={18} className="text-accent" />
              Khả năng hỗ trợ
            </h3>
            <ul className="capability-list">
              <li>
                <Zap size={16} />
                <span><strong>Ghi số điện nước nhanh:</strong> Nhập cú pháp như "điện phòng A2 tháng 10 là 980" hoặc "số nước phòng B1 là 15".</span>
              </li>
              <li>
                <MessageSquare size={16} />
                <span><strong>Tra cứu phòng trống:</strong> Hỏi "phòng nào trống?", "còn phòng nào trống không?", "danh sách phòng trống".</span>
              </li>
              <li>
                <Info size={16} />
                <span><strong>Xem hóa đơn nợ:</strong> Hỏi "hóa đơn nào chưa đóng?", "hóa đơn nợ tháng này".</span>
              </li>
            </ul>

            <div className="quick-commands-section">
              <h4>Gợi ý lệnh nhanh mẫu</h4>
              <div className="quick-command-chips">
                {GOI_Y_CHI_TIET.map((item) => (
                  <button
                    key={item.text}
                    type="button"
                    className="quick-command-chip"
                    onClick={() => guiTinNhan(item.text)}
                    disabled={loading}
                  >
                    <span style={{ display: 'block', color: 'var(--accent)', fontSize: '0.75rem', marginBottom: '2px' }}>
                      {item.label}
                    </span>
                    {item.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
