export interface QuoteFormData {
  name: string;
  email: string;
  phone: string;
  projectType: string;
  summary: string;
}

export type QuoteFormErrors = Partial<Record<keyof QuoteFormData, string>>;

export interface ValidationResult {
  valid: boolean;
  errors: QuoteFormErrors;
}

export const PROJECT_TYPES = [
  { value: 'site-sob-medida', label: 'Site Independente Sob Medida' },
  { value: 'landing-alta-conversao', label: 'Landing Page Interativa & Alta Conversão' },
  { value: 'sistema-web-saas', label: 'Aplicação Web / Plataforma Digital' },
  { value: 'ecommerce-exclusivo', label: 'E-Commerce Próprio de Alta Performance' },
  { value: 'redesign-posicionamento', label: 'Redesign Completo & Novo Posicionamento' },
] as const;

export const DKM_WHATSAPP_NUMBER = '5511999999999';

export function sanitizeDigits(input: string): string {
  return input.replace(/\D/g, '');
}

export function formatPhoneDisplay(raw: string): string {
  const digits = sanitizeDigits(raw).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function validateQuoteForm(data: QuoteFormData): ValidationResult {
  const errors: QuoteFormErrors = {};

  const trimmedName = data.name.trim();
  if (!trimmedName) {
    errors.name = 'Informe seu nome ou empresa.';
  } else if (trimmedName.length < 2) {
    errors.name = 'O nome deve ter pelo menos 2 caracteres.';
  }

  const trimmedEmail = data.email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmedEmail) {
    errors.email = 'Informe seu e-mail para contato.';
  } else if (!emailRegex.test(trimmedEmail)) {
    errors.email = 'Digite um endereço de e-mail válido.';
  }

  const phoneDigits = sanitizeDigits(data.phone);
  if (!phoneDigits) {
    errors.phone = 'Informe seu WhatsApp ou telefone com DDD.';
  } else if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    errors.phone = 'Informe um número válido com DDD (10 ou 11 dígitos).';
  }

  if (!data.projectType.trim()) {
    errors.projectType = 'Selecione o tipo de projeto.';
  }

  const trimmedSummary = data.summary.trim();
  if (!trimmedSummary) {
    errors.summary = 'Conte brevemente sobre a ideia do projeto.';
  } else if (trimmedSummary.length < 10) {
    errors.summary = 'Detalhe um pouco mais sua necessidade (mínimo 10 caracteres).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getProjectTypeLabel(value: string): string {
  const found = PROJECT_TYPES.find((item) => item.value === value);
  return found ? found.label : value;
}

export function buildWhatsAppMessage(data: QuoteFormData): string {
  const projectLabel = getProjectTypeLabel(data.projectType);
  const lines = [
    'Olá, equipe *DKM*! Acessei a experiência interativa e gostaria de solicitar uma cotação para o meu projeto.',
    '',
    '*— DADOS DO PROJETO —*',
    `• *Nome:* ${data.name.trim()}`,
    `• *E-mail:* ${data.email.trim()}`,
    `• *WhatsApp:* ${data.phone.trim()}`,
    `• *Tipo de Projeto:* ${projectLabel}`,
    '',
    '*— RESUMO DA IDEIA —*',
    data.summary.trim(),
  ];
  return lines.join('\n');
}

export function buildWhatsAppUrl(
  data: QuoteFormData,
  targetNumber: string = DKM_WHATSAPP_NUMBER
): string {
  const cleanNumber = sanitizeDigits(targetNumber) || DKM_WHATSAPP_NUMBER;
  const message = buildWhatsAppMessage(data);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}
