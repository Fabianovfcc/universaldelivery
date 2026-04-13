import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { googleMapsLoader } from '../../lib/googleMaps'

const NovoPedido = () => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    endereco_entrega: '',
    lat: null,
    lng: null,
    valor_pedido: '',
    itens: '',
    ifood_id: '',
    observacoes: ''
  })
  
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Inicializar Autocomplete do Google Places
  useEffect(() => {
    googleMapsLoader.load().then((google) => {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ['address_components', 'geometry', 'formatted_address'],
        // Removido types: ['address'] para permitir encontrar estabelecimentos como a UCP
        componentRestrictions: { country: ['BR', 'PY'] }
      })

      // Adicionar CSS para o dropdown do Google não sumir
      const style = document.createElement('style')
      style.innerHTML = `
        .pac-container { 
          z-index: 9999 !important; 
          border-radius: 12px; 
          border: 1px solid var(--border);
          background-color: var(--bg-card) !important;
          color: white !important;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .pac-item { border-top: 1px solid var(--border); color: #9090b0; padding: 8px 12px; cursor: pointer; }
        .pac-item:hover { background-color: var(--bg-card-hover) !important; }
        .pac-item-query { color: white !important; font-size: 14px; }
        .pac-matched { color: var(--accent-primary) !important; }
      `
      document.head.appendChild(style)

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place.geometry) {
          alert('Por favor, selecione um endereço da lista de sugestões.')
          return
        }

        setFormData(prev => ({
          ...prev,
          endereco_entrega: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        }))
      })
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.lat || !formData.lng) {
      alert('⚠️ Erro: Você precisa selecionar um endereço válido nas sugestões do Google.')
      return
    }

    setLoading(true)
    try {
      const link_rastreio = Math.random().toString(36).substring(2, 10)

      const { error } = await supabase
        .from('pedidos')
        .insert([{
          cliente_nome: formData.cliente_nome,
          cliente_telefone: formData.cliente_telefone,
          endereco_entrega: formData.endereco_entrega,
          lat: formData.lat,
          lng: formData.lng,
          valor_pedido: parseFloat(formData.valor_pedido),
          itens: formData.itens,
          ifood_id: formData.ifood_id,
          link_rastreio,
          status: 'pendente'
        }])

      if (error) throw error

      alert('✅ Pedido cadastrado e geolocalizado com sucesso!')
      navigate('/admin')
    } catch (err) {
      alert(`Erro ao salvar: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">🚀 Novo Pedido</h1>
            <p className="page-subtitle">Utilize o seletor inteligente para máxima precisão</p>
          </div>
        </header>

        <section className="card animate-slide" style={{ maxWidth: '700px' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome do Cliente</label>
                <input name="cliente_nome" className="form-input" required value={formData.cliente_nome} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone (WhatsApp)</label>
                <input name="cliente_telefone" className="form-input" placeholder="(00) 00000-0000" value={formData.cliente_telefone} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Endereço de Entrega (Selecione a sugestão)</label>
              <input 
                ref={inputRef}
                name="endereco_entrega" 
                className="form-input" 
                required 
                placeholder="Comece a digitar o endereço..."
                defaultValue={formData.endereco_entrega}
              />
              <p style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px' }}>
                {formData.lat ? `✅ Localização fixada: ${formData.lat.toFixed(4)}, ${formData.lng.toFixed(4)}` : '⌛ Aguardando seleção...'}
              </p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input name="valor_pedido" type="number" step="0.01" className="form-input" required value={formData.valor_pedido} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">ID Externo</label>
                <input name="ifood_id" className="form-input" placeholder="#1234" value={formData.ifood_id} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Itens</label>
              <textarea name="itens" className="form-textarea" value={formData.itens} onChange={handleChange}></textarea>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !formData.lat}>
                {loading ? 'Salvando...' : '🚀 Salvar Pedido'}
              </button>
              <button type="button" className="btn btn-outline btn-lg" onClick={() => navigate('/admin')}>Cancelar</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}

export default NovoPedido
