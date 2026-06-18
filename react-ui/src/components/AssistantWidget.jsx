import { useState } from 'react'
import { Bot, Check, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { guiTinNhanAssistant, thucThiLenhAssistant } from '../api'

const GOI_Y = [
  'Nhập số điện tháng 10 phòng A1 là 1000',
  'Phòng nào còn trống?',
  'Hóa đơn nào chưa thanh toán tháng 10?'
]

function taoTinNhan(role, text, data = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    ...data
  }
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([
    taoTinNhan('assistant', 'Bạn cần mình làm gì? Mình có thể nhập số điện, tìm phòng trống hoặc xem hóa đơn chưa thanh toán.')
  ])

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
          suggestions: response.suggestions || []
        })
      ])
    } catch (error) {
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
      setMessages((items) => [
        ...items,
        taoTinNhan('assistant', response.message || 'Đã thực hiện xong.', {
          type: response.type,
          result: response.result
        })
      ])
    } catch (error) {
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
    <div className={`assistant-widget ${open ? 'assistant-widget--open' : ''}`}>
      {open && (
        <section className="assistant-panel" aria-label="Trợ lý thao tác nhanh">
          <header className="assistant-panel__header">
            <div>
              <span className="assistant-panel__eyebrow">Trợ lý</span>
              <h2>Nhập lệnh nhanh</h2>
            </div>
            <button type="button" className="assistant-icon-btn" onClick={() => setOpen(false)} aria-label="Đóng trợ lý">
              <X size={18} />
            </button>
          </header>

          <div className="assistant-panel__messages">
            {messages.map((message) => (
              <article key={message.id} className={`assistant-message assistant-message--${message.role}`}>
                <p>{message.text}</p>
                {message.type === 'confirmation_required' && message.commandId && (
                  <button type="button" className="assistant-confirm" onClick={() => xacNhanLenh(message.commandId)} disabled={loading}>
                    <Check size={16} />
                    Xác nhận thực hiện
                  </button>
                )}
                {message.suggestions?.length > 0 && (
                  <div className="assistant-suggestions">
                    {message.suggestions.map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => guiTinNhan(suggestion)} disabled={loading}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {loading && (
              <article className="assistant-message assistant-message--assistant">
                <p className="assistant-loading"><Loader2 size={15} /> Đang xử lý...</p>
              </article>
            )}
          </div>

          <div className="assistant-quick-row">
            {GOI_Y.map((text) => (
              <button key={text} type="button" onClick={() => guiTinNhan(text)} disabled={loading}>
                {text}
              </button>
            ))}
          </div>

          <form className="assistant-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ví dụ: nhập số điện tháng 10 phòng A1 là 1000"
            />
            <button type="submit" aria-label="Gửi yêu cầu" disabled={loading || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}

      <button type="button" className="assistant-fab" onClick={() => setOpen((value) => !value)} aria-label="Mở trợ lý">
        {open ? <X size={22} /> : <MessageCircle size={23} />}
        {!open && <Bot size={16} className="assistant-fab__bot" />}
      </button>
    </div>
  )
}
