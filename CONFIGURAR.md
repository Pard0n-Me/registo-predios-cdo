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
5. **Authentication › Users › Add user › Create new user**: o teu email **e uma password** (gera-a no gestor de passwords), com *Auto Confirm User* ligado. Se já criaste o utilizador sem password, apaga-o e cria de novo. A password é só tua: escreve-a tu, nunca a envies ao Claude.
6. ~~Modelo de email~~: não é preciso. Sem SMTP próprio a Supabase não deixa editar os modelos, por isso a app entra com **email + password** (funciona dentro da app instalada no iPhone e a sessão fica guardada).
7. **Project Settings › API** (ou *Data API*): copia
   - **Project URL**: na versão nova do painel aparece como *API URL* (`https://xxxx.supabase.co/rest/v1/`); a app usa só `https://xxxx.supabase.co`, sem o `/rest/v1/`.
   - **publishable key** (`sb_publishable_…`) ou a anon key antiga.

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
Abre o endereço no **Safari** › botão Partilhar › **Adicionar ao ecrã principal**. Abre pelo ícone "Prédios CdO" e entra com o teu email e a password (o iPhone pode guardá-la nas Passwords).

## Para testar no Mac (opcional)
```bash
cp .env.example .env.local   # e preenche as duas variáveis
npm install
npm run dev
```
