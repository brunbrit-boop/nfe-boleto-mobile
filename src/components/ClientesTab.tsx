import React, { useState } from 'react';
import { Search, Phone, MessageSquare, Building2, User, MapPin, Sparkles, RefreshCw, X } from 'lucide-react';
import type { BlingCliente } from '../types';

interface ClientesTabProps {
  clientes: BlingCliente[];
  isLoading: boolean;
  isLive: boolean;
  onRefresh: () => void;
  onEmitirParaCliente: (cliente: BlingCliente) => void;
}

export const ClientesTab: React.FC<ClientesTabProps> = ({
  clientes,
  isLoading,
  isLive,
  onRefresh,
  onEmitirParaCliente,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'todos' | 'J' | 'F'>('todos');
  const [selectedCliente, setSelectedCliente] = useState<BlingCliente | null>(null);

  // Filtragem dos clientes do Bling
  const clientesFiltrados = clientes.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchName = c.nome.toLowerCase().includes(term) || (c.fantasia && c.fantasia.toLowerCase().includes(term));
    const matchDoc = c.numeroDocumento.replace(/\D/g, '').includes(term.replace(/\D/g, ''));
    const matchCity = c.endereco?.geral?.municipio?.toLowerCase().includes(term);

    const matchesSearch = matchName || matchDoc || matchCity;
    const matchesTipo = filterTipo === 'todos' || c.tipoPessoa === filterTipo;

    return matchesSearch && matchesTipo;
  });

  const handleWhatsApp = (celular?: string) => {
    if (!celular) return;
    const numLimpo = celular.replace(/\D/g, '');
    const numComDdi = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;
    window.open(`https://api.whatsapp.com/send?phone=${numComDdi}`, '_blank');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-xl mx-auto w-full pb-36">
      {/* Top Header com Status de Sincronização */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Clientes & Contatos</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {clientes.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Base de dados sincronizada com o Bling ERP
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition active:scale-95"
            title="Sincronizar com a API do Bling"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLive ? 'Bling Ao Vivo' : 'Sincronizar'}</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nome, Fantasia, CNPJ ou Cidade..."
            className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Chips de Filtro */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterTipo('todos')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              filterTipo === 'todos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos ({clientes.length})
          </button>
          <button
            onClick={() => setFilterTipo('J')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              filterTipo === 'J'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Empresas (PJ)
          </button>
          <button
            onClick={() => setFilterTipo('F')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              filterTipo === 'F'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Pessoa Física (PF)
          </button>
        </div>
      </div>

      {/* Lista de Clientes */}
      <div className="space-y-2.5">
        {clientesFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Nenhum cliente encontrado</p>
            <p className="text-xs text-slate-400 mt-1">
              Tente buscar com outro termo ou sincronize com o Bling.
            </p>
          </div>
        ) : (
          clientesFiltrados.map((cliente) => (
            <div
              key={cliente.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card hover:shadow-card-hover transition space-y-2.5"
            >
              {/* Header do Card */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                    {cliente.tipoPessoa === 'J' ? (
                      <Building2 className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">
                      {cliente.fantasia || cliente.nome}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {cliente.numeroDocumento}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    cliente.situacao === 'A'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {cliente.situacao === 'A' ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              {/* Detalhes de Endereço e Contato */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1 border-t border-slate-100">
                {cliente.endereco?.geral && (
                  <div className="flex items-center gap-1 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {cliente.endereco.geral.municipio} - {cliente.endereco.geral.uf}
                    </span>
                  </div>
                )}
                {(cliente.celular || cliente.telefone) && (
                  <div className="flex items-center gap-1 text-[11px]">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cliente.celular || cliente.telefone}</span>
                  </div>
                )}
              </div>

              {/* Botões de Ações Rápidas */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {cliente.celular && (
                  <button
                    onClick={() => handleWhatsApp(cliente.celular)}
                    className="flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 px-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedCliente(cliente)}
                  className="flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 px-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition active:scale-95"
                >
                  <span>Ver Detalhes</span>
                </button>

                <button
                  onClick={() => onEmitirParaCliente(cliente)}
                  className="flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 px-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition active:scale-95 col-span-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>Emitir NF-e</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Detalhes do Cliente */}
      {selectedCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Ficha do Cliente Bling
                </h3>
              </div>
              <button
                onClick={() => setSelectedCliente(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Razão Social / Nome</span>
                <span className="text-sm font-bold text-slate-900 block">{selectedCliente.nome}</span>
                {selectedCliente.fantasia && (
                  <span className="text-xs text-slate-500 font-medium">Nome Fantasia: {selectedCliente.fantasia}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">CPF / CNPJ</span>
                  <span className="font-mono font-bold text-slate-800">{selectedCliente.numeroDocumento}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Inscrição Estadual</span>
                  <span className="font-mono text-slate-800">{selectedCliente.ie || 'ISENTO'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Endereço Completo</span>
                <p className="text-slate-700">
                  {selectedCliente.endereco?.geral?.endereco}, {selectedCliente.endereco?.geral?.numero}
                  {selectedCliente.endereco?.geral?.bairro && ` - ${selectedCliente.endereco.geral.bairro}`}
                  <br />
                  {selectedCliente.endereco?.geral?.municipio} - {selectedCliente.endereco?.geral?.uf} • CEP: {selectedCliente.endereco?.geral?.cep}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">E-mail</span>
                  <span className="text-slate-700 truncate block">{selectedCliente.email || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Telefone</span>
                  <span className="text-slate-700">{selectedCliente.celular || selectedCliente.telefone || 'Não informado'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedCliente(null)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  const c = selectedCliente;
                  setSelectedCliente(null);
                  onEmitirParaCliente(c);
                }}
                className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm"
              >
                Emitir Venda no Robô
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
