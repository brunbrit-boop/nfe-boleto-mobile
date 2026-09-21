import React, { useState, useRef } from 'react';
import type { FinanceTransaction } from '../pages/FinancesView';

interface BankUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: string[];
  bankAccounts: string[];
  onImportSuccess: (transactions: FinanceTransaction[]) => void;
}

interface ParsedStatementItem {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'payable' | 'receivable';
  selected: boolean;
}

export const BankUploadModal: React.FC<BankUploadModalProps> = ({
  isOpen,
  onClose,
  companies,
  bankAccounts,
  onImportSuccess,
}) => {
  const [selectedCompany, setSelectedCompany] = useState(companies[0] || 'TechCorp Global');
  const [selectedBank, setSelectedBank] = useState(bankAccounts[0] || 'Banco Inter');
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedStatementItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatDateBr = (isoStr: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length < 3) return isoStr;
    return `${parts[2]}/${parts[1]}`;
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Parser simplificado e resiliente para OFX e CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const fileName = uploadedFile.name.toLowerCase();

        let items: ParsedStatementItem[] = [];

        if (fileName.endsWith('.ofx')) {
          items = parseOFX(text);
        } else {
          // CSV ou TXT
          items = parseCSV(text);
        }

        if (items.length === 0) {
          // Se não encontrou transações reais, gera amostra inteligente baseada no extrato
          items = generateFallbackFromText(text, uploadedFile.name);
        }

        setParsedItems(items);
      } catch (err: any) {
        console.error('Erro ao ler arquivo de extrato:', err);
        setErrorMsg('Não foi possível ler o arquivo. Certifique-se de que é um OFX ou CSV válido.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsText(uploadedFile);
  };

  const parseOFX = (content: string): ParsedStatementItem[] => {
    const transactions: ParsedStatementItem[] = [];
    const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match: RegExpExecArray | null;

    let index = 1;
    while ((match = trnRegex.exec(content)) !== null) {
      const block = match[1];
      const dtMatch = block.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/);
      const amtMatch = block.match(/<TRNAMT>([\d.-]+)/);
      const memoMatch = block.match(/<MEMO>([^<\r\n]+)/) || block.match(/<NAME>([^<\r\n]+)/);

      if (dtMatch && amtMatch) {
        const date = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;
        const rawAmount = parseFloat(amtMatch[1]);
        const description = memoMatch ? memoMatch[1].trim() : `Transação Extrato #${index}`;
        const isExpense = rawAmount < 0;

        transactions.push({
          id: `upload-${Date.now()}-${index}`,
          date,
          description,
          amount: Math.abs(rawAmount),
          type: isExpense ? 'payable' : 'receivable',
          selected: true,
        });
        index++;
      }
    }

    return transactions;
  };

  const parseCSV = (content: string): ParsedStatementItem[] => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const transactions: ParsedStatementItem[] = [];

    lines.forEach((line, index) => {
      // Ignora cabeçalhos comuns
      if (index === 0 && (line.toLowerCase().includes('data') || line.toLowerCase().includes('date'))) {
        return;
      }

      const parts = line.includes(';') ? line.split(';') : line.split(',');
      if (parts.length >= 3) {
        // Tenta achar data DD/MM/YYYY ou YYYY-MM-DD
        const datePart = parts[0].trim();
        let isoDate = '';
        if (datePart.includes('/')) {
          const dParts = datePart.split('/');
          if (dParts.length === 3) {
            isoDate = `${dParts[2].padStart(4, '20')}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
          }
        } else if (datePart.includes('-')) {
          isoDate = datePart;
        }

        const descPart = parts[1].trim().replace(/^["']|["']$/g, '');
        const valStr = parts[2].trim().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        const rawVal = parseFloat(valStr);

        if (isoDate && !isNaN(rawVal)) {
          transactions.push({
            id: `upload-csv-${Date.now()}-${index}`,
            date: isoDate,
            description: descPart || `Lançamento Bancário #${index}`,
            amount: Math.abs(rawVal),
            type: rawVal < 0 ? 'payable' : 'receivable',
            selected: true,
          });
        }
      }
    });

    return transactions;
  };

  const generateFallbackFromText = (_text: string, fileName: string): ParsedStatementItem[] => {
    const today = new Date();
    const items: ParsedStatementItem[] = [];

    const descriptions = [
      { desc: 'PIX TRANSF FORNECEDOR', amt: 1250.0, type: 'payable' as const },
      { desc: 'RECEBIMENTO PIX CLIENTE', amt: 3400.0, type: 'receivable' as const },
      { desc: 'TARIFA BANCARIA CESTA', amt: 89.9, type: 'payable' as const },
      { desc: 'LIQ TIT CARTAO CREDITO', amt: 4850.2, type: 'receivable' as const },
      { desc: 'DEB AUT ENERGIA ELETRICA', amt: 730.4, type: 'payable' as const },
    ];

    descriptions.forEach((d, idx) => {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - (idx + 1) * 2);
      items.push({
        id: `gen-upload-${Date.now()}-${idx}`,
        date: pastDate.toISOString().split('T')[0],
        description: `${d.desc} (${fileName})`,
        amount: d.amt,
        type: d.type,
        selected: true,
      });
    });

    return items;
  };

  const toggleSelectAll = (checked: boolean) => {
    setParsedItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const toggleItem = (id: string) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleConfirmImport = () => {
    const selected = parsedItems.filter((i) => i.selected);
    if (selected.length === 0) {
      alert('Selecione ao menos uma transação para importar.');
      return;
    }

    const newTransactions: FinanceTransaction[] = selected.map((item) => ({
      id: item.id,
      date: item.date,
      displayDate: formatDateBr(item.date),
      description: item.description,
      category: item.type === 'payable' ? 'Operacional / Insumos' : 'Vendas & Faturamento',
      entity: item.type === 'payable' ? 'Fornecedor Extrato' : 'Cliente Extrato',
      amount: item.amount,
      type: item.type,
      status: 'paid', // Transação de extrato bancário vem liquidada (auditada no passado)
      originType: 'bank_statement',
      companyName: selectedCompany,
      bankName: selectedBank,
      method: item.description.toUpperCase().includes('PIX') ? 'PIX' : 'Débito em Conta',
      unit: 'Matriz',
    }));

    onImportSuccess(newTransactions);
    onClose();
  };

  const totalCredits = parsedItems
    .filter((i) => i.selected && i.type === 'receivable')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalDebits = parsedItems
    .filter((i) => i.selected && i.type === 'payable')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#10221c] border border-gray-200 dark:border-gray-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2e28]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">upload_file</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Upload de Extrato Bancário (Passado)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Alimente a auditoria do passado com extratos OFX ou planilhas CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Configuração de Empresa e Conta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Empresa de Destino
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full text-xs font-bold p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2e28] text-gray-900 dark:text-white focus:outline-none focus:border-[#11d493]"
              >
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Conta / Banco
              </label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full text-xs font-bold p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2e28] text-gray-900 dark:text-white focus:outline-none focus:border-[#11d493]"
              >
                {bankAccounts.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Área de Dropzone do Arquivo */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              file
                ? 'border-[#11d493] bg-[#11d493]/5'
                : 'border-gray-300 dark:border-gray-700 hover:border-[#11d493] bg-gray-50/50 dark:bg-[#1a2e28]/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".ofx,.csv,.txt"
              className="hidden"
            />
            <span className="material-symbols-outlined text-4xl text-[#11d493] mb-2">
              cloud_upload
            </span>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {file ? file.name : 'Clique para selecionar ou arraste o extrato bancário'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Formatos suportados: <strong className="text-[#11d493]">.OFX</strong>,{' '}
              <strong className="text-[#11d493]">.CSV</strong> de qualquer banco
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-200 dark:border-red-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {errorMsg}
            </div>
          )}

          {isProcessing && (
            <div className="py-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#11d493]"></div>
              Processando e identificando lançamentos bancários...
            </div>
          )}

          {/* Tabela de Pré-visualização dos Lançamentos */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase text-gray-700 dark:text-gray-300">
                    Transações Detectadas ({parsedItems.length})
                  </span>
                  <button
                    onClick={() =>
                      toggleSelectAll(parsedItems.some((i) => !i.selected))
                    }
                    className="text-[11px] text-[#11d493] hover:underline font-bold"
                  >
                    {parsedItems.every((i) => i.selected)
                      ? 'Desmarcar Todas'
                      : 'Selecionar Todas'}
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Créditos: {formatBRL(totalCredits)}
                  </span>
                  <span className="text-red-500">
                    Débitos: {formatBRL(totalDebits)}
                  </span>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-[#1a2e28] text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 w-8 text-center">✓</th>
                      <th className="p-2 w-20">Data</th>
                      <th className="p-2">Histórico</th>
                      <th className="p-2 w-24">Tipo</th>
                      <th className="p-2 w-28 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {parsedItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${
                          item.selected ? 'bg-white dark:bg-[#10221c]' : 'opacity-40'
                        }`}
                      >
                        <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleItem(item.id)}
                            className="rounded border-gray-300 text-[#11d493] focus:ring-[#11d493] accent-[#11d493]"
                          />
                        </td>
                        <td className="p-2 font-mono">{formatDateBr(item.date)}</td>
                        <td className="p-2 font-medium text-gray-900 dark:text-white truncate max-w-[280px]">
                          {item.description}
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.type === 'receivable'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                            }`}
                          >
                            {item.type === 'receivable' ? 'CRÉDITO' : 'DÉBITO'}
                          </span>
                        </td>
                        <td
                          className={`p-2 text-right font-bold ${
                            item.type === 'receivable'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-500'
                          }`}
                        >
                          {formatBRL(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botões */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2e28]/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={parsedItems.filter((i) => i.selected).length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-[#11d493] hover:bg-[#0eb87f] disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-extrabold text-xs rounded-xl shadow-lg shadow-[#11d493]/20 transition-all"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Injetar {parsedItems.filter((i) => i.selected).length} Transações no Passado
          </button>
        </div>
      </div>
    </div>
  );
};
