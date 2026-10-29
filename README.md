# DKM — Engenharia Digital & Sites Independentes
<img width="1280" height="720" alt="Image" src="https://github.com/user-attachments/assets/dd68d685-ff08-4a6d-a164-b1b2e3a97de0" />
Landing page interativa em 3D desenvolvida para a **DKM**, com cubo mágico 3x3x3 de vidro prismático procedural em **Three.js / WebGL** (`InstancedMesh` + GLSL Shader customizado), sistema de partículas luminosas na GPU, tipografia flutuante com efeito de desintegração no scroll e captação direta integrada ao **WhatsApp**.

## Tecnologias

- **React 19 + TypeScript + Vite**
- **Three.js** (Geometria chanfrada procedural, `InstancedMesh` de chamada única e Shaders GLSL de dispersão prismática)
- **Tailwind CSS v4**

## Como rodar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Gere a versão de produção:
   ```bash
   npm run build
   ```

## Configuração do número de WhatsApp

Para alterar o número padrão que recebe os pedidos de cotação, edite a constante `DEFAULT_DKM_WHATSAPP` em `src/utils/whatsappForm.ts` (formato com DDI + DDD + número, ex.: `5511999999999`).
