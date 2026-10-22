import React, { useState } from 'react';
import { Send, CheckCircle2, Copy, ExternalLink, AlertCircle } from 'lucide-react';
import {
  QuoteFormData,
  QuoteFormErrors,
  PROJECT_TYPES,
  validateQuoteForm,
  formatPhoneDisplay,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
} from '../utils/whatsappForm';

export const WhatsAppQuoteForm: React.FC = () => {
  const [formData, setFormData] = useState<QuoteFormData>({
    name: '',
    email: '',
    phone: '',
    projectType: '',
    summary: '',
  });

  const [errors, setErrors] = useState<QuoteFormErrors>({});
  const [submittedPayload, setSubmittedPayload] = useState<{
    message: string;
    waUrl: string;
    copied: boolean;
  } | null>(null);

  const handleFieldChange = (field: keyof QuoteFormData, value: string) => {
    const formattedValue =
      field === 'phone' ? formatPhoneDisplay(value) : value;
    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validation = validateQuoteForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSubmittedPayload(null);
      return;
    }

    setErrors({});
    const message = buildWhatsAppMessage(formData);
    const waUrl = buildWhatsAppUrl(formData);

    setSubmittedPayload({
      message,
      waUrl,
      copied: false,
    });

    const linkEl = document.createElement('a');
    linkEl.href = waUrl;
    linkEl.target = '_blank';
    linkEl.rel = 'noopener noreferrer';
    document.body.appendChild(linkEl);
    linkEl.click();
    document.body.removeChild(linkEl);
  };

  const handleCopyMessage = async () => {
    if (!submittedPayload) return;
    try {
      await navigator.clipboard.writeText(submittedPayload.message);
      setSubmittedPayload((prev) => (prev ? { ...prev, copied: true } : null));
    } catch {
      setSubmittedPayload((prev) => (prev ? { ...prev, copied: true } : null));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-5 text-center">
        <div className="text-xs font-mono tracking-wider text-sky-400/90 mb-1.5">
          04 · INICIAR PROJETO
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
          Solicite sua proposta sob medida.
        </h2>
        <p className="mt-1.5 text-sm text-slate-400">
          Preencha os dados para abrir a conversa diretamente no WhatsApp da DKM.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-3.5 bg-[#050811]/90 border border-slate-800/80 rounded-2xl p-5 sm:p-7 shadow-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Nome */}
          <div>
            <label
              htmlFor="dkm-name"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Nome ou Empresa
            </label>
            <input
              id="dkm-name"
              name="name"
              type="text"
              autoComplete="name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="Seu nome ou marca"
              className={`w-full px-3.5 py-2.5 text-sm bg-[#020409] border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.name
                  ? 'border-red-500/80 focus:ring-red-500/40'
                  : 'border-slate-800 focus:border-[#0066FF] focus:ring-[#0066FF]/30'
              }`}
            />
            {errors.name && (
              <p
                role="alert"
                className="mt-1 text-xs text-red-400 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          {/* E-mail */}
          <div>
            <label
              htmlFor="dkm-email"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              E-mail
            </label>
            <input
              id="dkm-email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              placeholder="contato@empresa.com.br"
              className={`w-full px-3.5 py-2.5 text-sm bg-[#020409] border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.email
                  ? 'border-red-500/80 focus:ring-red-500/40'
                  : 'border-slate-800 focus:border-[#0066FF] focus:ring-[#0066FF]/30'
              }`}
            />
            {errors.email && (
              <p
                role="alert"
                className="mt-1 text-xs text-red-400 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.email}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Telefone / WhatsApp */}
          <div>
            <label
              htmlFor="dkm-phone"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Telefone / WhatsApp
            </label>
            <input
              id="dkm-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={formData.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              placeholder="(11) 98765-4321"
              className={`w-full px-3.5 py-2.5 text-sm bg-[#020409] border rounded-lg text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 transition-colors ${
                errors.phone
                  ? 'border-red-500/80 focus:ring-red-500/40'
                  : 'border-slate-800 focus:border-[#0066FF] focus:ring-[#0066FF]/30'
              }`}
            />
            {errors.phone && (
              <p
                role="alert"
                className="mt-1 text-xs text-red-400 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.phone}</span>
              </p>
            )}
          </div>

          {/* Tipo de Projeto */}
          <div>
            <label
              htmlFor="dkm-project-type"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Tipo de Projeto
            </label>
            <select
              id="dkm-project-type"
              name="projectType"
              value={formData.projectType}
              onChange={(e) => handleFieldChange('projectType', e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm bg-[#020409] border rounded-lg text-white focus:outline-none focus:ring-2 transition-colors ${
                errors.projectType
                  ? 'border-red-500/80 focus:ring-red-500/40'
                  : 'border-slate-800 focus:border-[#0066FF] focus:ring-[#0066FF]/30'
              }`}
            >
              <option value="">Selecione uma opção...</option>
              {PROJECT_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
            {errors.projectType && (
              <p
                role="alert"
                className="mt-1 text-xs text-red-400 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.projectType}</span>
              </p>
            )}
          </div>
        </div>

        {/* Breve resumo da ideia */}
        <div>
          <label
            htmlFor="dkm-summary"
            className="block text-xs font-medium text-slate-300 mb-1"
          >
            Breve resumo da ideia
          </label>
          <textarea
            id="dkm-summary"
            name="summary"
            rows={2}
            value={formData.summary}
            onChange={(e) => handleFieldChange('summary', e.target.value)}
            placeholder="Descreva o que sua marca precisa e o objetivo principal do site..."
            className={`w-full px-3.5 py-2 text-sm bg-[#020409] border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors resize-y ${
              errors.summary
                ? 'border-red-500/80 focus:ring-red-500/40'
                : 'border-slate-800 focus:border-[#0066FF] focus:ring-[#0066FF]/30'
            }`}
          />
          {errors.summary && (
            <p
              role="alert"
              className="mt-1 text-xs text-red-400 flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.summary}</span>
            </p>
          )}
        </div>

        <div className="pt-1.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Atendimento direto · Mensagem formatada automaticamente.
          </p>
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Solicitar Cotação / Iniciar Projeto</span>
          </button>
        </div>

        {submittedPayload && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 pt-4 border-t border-slate-800/80 space-y-3"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold">
                  Cotação pronta para envio no WhatsApp!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 rounded-md hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {submittedPayload.copied ? 'Copiado!' : 'Copiar Texto'}
                  </span>
                </button>
                <a
                  href={submittedPayload.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Abrir WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
