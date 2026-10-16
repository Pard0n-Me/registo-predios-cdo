# Configurar o Registo de Prédios (Supabase + Vercel)

Sem configuração, a app abre em **modo demonstração** (dados fictícios guardados só no aparelho). Para usar a sério, segue estes passos. Demora cerca de 15 minutos.

## 1. Supabase (base de dados e login)
1. Em **supabase.com**, entra com o GitHub (*Sign in with GitHub*).
2. **New project**
   - Nome: `registo-predios-cdo`
   - Database password: gera uma e guarda-a no gestor de passwords (não a envies ao Claude).
   - Região: **West EU (Ireland)** ou **Central EU (Frankfurt)**.
   - Plano: Free.
3. Quando o projeto estiver pronto: **SQL Editor › New query**. Cola o conteúdo de `supabase/schema.sql` e carrega em **Run**. Deve aparecer "Success. No rows returned".
4. **Authentication › Sign In / Providers › Email**: deixa ativo. Depois, em **Authentication › Settings** (ou *Sign In / Providers*), **desliga "Allow new users to sign up"**. Assim ninguém mais consegue criar conta.
5. **Authentication › Users › Add user › Create new user**: o teu email, com *Auto Confirm User* ligado. Não precisas de password; entras com um código por email.
6. **Authentication › Emails › Templates › Magic Link**: no corpo, acrescenta a linha
   `O teu código: {{ .Token }}`
   (a app pede o código de 6 dígitos; assim funciona dentro da app instalada no iPhone, sem saltar para o Safari).
7. **Project Settings › API** (ou *Data API*): copia
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon / publishable key**

   Estas duas podem ser partilhadas com o Claude: são públicas por natureza e a segurança vem do login e das regras da base de dados. **Nunca** partilhes a `service_role` / *secret key*.

## 2. GitHub
Cria um repositório **privado** vazio chamado `registo-predios-cdo` (sem README) e diz ao Claude o endereço. O Claude faz o primeiro *push* depois do teu OK.

## 3. Vercel (publicação)
1. **Add New › Project** › importa o repositório `registo-predios-cdo`.
2. Framework: Vite (detetado automaticamente). Root directory: a raiz do repositório.
3. **Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
4. **Deploy**. Fica com um endereço tipo `registo-predios-cdo.vercel.app`.
5. De volta à Supabase, em **Authentication › URL Configuration**, põe esse endereço em **Site URL**.

## 4. iPhone
Abre o endereço no **Safari** › botão Partilhar › **Adicionar ao ecrã principal**. Abre pelo ícone "Prédios CdO" e entra com o teu email e o código.

## Para testar no Mac (opcional)
```bash
cp .env.example .env.local   # e preenche as duas variáveis
npm install
npm run dev
```
