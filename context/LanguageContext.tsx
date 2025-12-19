
import React, { createContext, useContext, useState } from 'react';

const ptMessages = {
  "common": {
    "online": "Online",
    "cancel": "Cancelar",
    "delete": "Excluir",
    "deleting": "Excluindo...",
    "you": "Você",
    "user": "Usuário",
    "send": "Enviar",
    "save": "Salvar",
    "error": "Ocorreu um erro. Tente novamente."
  },
  "login": {
    "title": "Vibe",
    "emailLabel": "E-mail",
    "passwordLabel": "Senha",
    "loginButton": "Entrar",
    "loggingInButton": "Entrando...",
    "forgotPassword": "Esqueceu a senha?",
    "noAccount": "Não tem uma conta?",
    "signUpLink": "Cadastre-se",
    "getTheApp": "Baixe o aplicativo.",
    "error": "Falha ao entrar. Verifique suas credenciais.",
    "installHere": "Instale aqui"
  },
  "signup": {
    "title": "Vibe",
    "subtitle": "Cadastre-se para ver fotos e vídeos dos seus amigos.",
    "emailLabel": "Endereço de e-mail",
    "usernameLabel": "Nome de usuário",
    "passwordLabel": "Senha",
    "signUpButton": "Cadastre-se",
    "signingUpButton": "Cadastrando...",
    "haveAccount": "Já tem uma conta?",
    "logInLink": "Conectar-se",
    "emailInUseError": "Este e-mail já está em uso.",
    "genericError": "Erro ao criar conta. Tente novamente."
  },
  "header": {
    "title": "Vibe",
    "searchPlaceholder": "Pesquisar pessoas...",
    "noResults": "Nenhum resultado.",
    "following": "Seguindo",
    "follow": "Seguir",
    "requested": "Solicitado",
    "notifications": "Notificações",
    "noActivity": "Nenhuma atividade nova.",
    "profile": "Perfil",
    "create": "Criar",
    "createPost": "Publicação",
    "createPulse": "Pulse (Story)",
    "createVibe": "Vibe (Vídeo)",
    "createStatus": "Música ou Texto",
    "vibes": "Vibes",
    "logOut": "Sair",
    "messages": "Direct",
    "home": "Início",
    "accept": "Aceitar",
    "decline": "Recusar",
    "browser": "Navegar na Internet",
    "followNotification": "{username} começou a seguir você.",
    "messageNotification": "{username} enviou uma mensagem.",
    "followRequestNotification": "{username} quer seguir você.",
    "mentionCommentNotification": "{username} mencionou você: \"{commentText}\"",
    "duoRequestNotification": "<b>{username}</b> te convidou para um Duo.",
    "tagRequestNotification": "<b>{username}</b> te marcou numa publicação.",
    "duoAcceptedNotification": "<b>{username}</b> aceitou seu convite de Duo.",
    "tagAcceptedNotification": "<b>{username}</b> aceitou sua marcação."
  },
  "post": {
    "like": "Curtir",
    "comment": "Comentar",
    "republish": "Republicar",
    "forward": "Encaminhar",
    "likes": "curtidas",
    "viewAllComments": "Ver todos os {count} comentários",
    "addComment": "Adicione um comentário...",
    "postButton": "Publicar",
    "delete": "Excluir",
    "editCaption": "Editar legenda",
    "addCaption": "Adicionar legenda",
    "changeMusic": "Trocar música",
    "addMusic": "Adicionar música",
    "tagFriends": "Marcar amigos",
    "inviteDuo": "Convidar Duo",
    "duoPending": "Duo Pendente",
    "duoPartner": "Com {username}",
    "deletePostTitle": "Excluir publicação?",
    "deletePostBody": "Tem certeza? Esta ação não pode ser desfeita.",
    "youRepublicated": "Você republicou",
    "republishedBy": "Republicado por {username}",
    "addToMemory": "Salvar na Memória",
    "anonymousComment": "Modo Anônimo",
    "anonymousCommentTaken": "Esta publicação já possui o limite de 1 comentário anônimo.",
    "vibeAnon": "Vibe Anon"
  },
  "browser": {
    "title": "Vibe Explorer",
    "placeholder": "Pesquise qualquer coisa na web...",
    "searching": "Navegando na internet...",
    "empty": "O que você quer descobrir hoje?",
    "sources": "Fontes da pesquisa:"
  },
  "forwardModal": {
    "title": "Encaminhar para",
    "search": "Pesquisar amigos...",
    "noFollowing": "Você não segue ninguém ainda.",
    "noResults": "Nenhum usuário encontrado.",
    "send": "Enviar",
    "sending": "Enviando...",
    "sent": "Enviado"
  },
  "diary": {
    "title": "Notas",
    "publish": "Publicar",
    "publishing": "Publicando...",
    "placeholder": "O que você está pensando?",
    "empty": "Nenhuma nota no momento.",
    "emptySuggestion": "Siga pessoas para ver as notas delas aqui!",
    "alreadyPosted": "Você já postou uma nota hoje. Volte amanhã!"
  },
  "duoModal": {
    "title": "Criar Foto em Dupla",
    "description": "Escolha um amigo para compartilhar este post. Ele receberá um convite para aceitar.",
    "sendRequest": "Enviar Convite",
    "sending": "Enviando...",
    "noFollowing": "Você não segue ninguém para convidar.",
    "requestSent": "Convite enviado!",
    "alreadyPartnered": "Este post já é um Duo.",
    "requestPending": "Já existe um convite pendente para este post.",
    "requestError": "Erro ao enviar convite."
  },
  "memories": {
    "new": "Nova",
    "add": "Adicionar",
    "title": "Memórias",
    "edit": "Editar Memória",
    "delete": "Excluir Memória",
    "deleteConfirm": "Tem certeza que deseja excluir esta memória? Isso não pode ser desfeito.",
    "selectContent": "Selecionar Conteúdo",
    "next": "Próximo",
    "name": "Nome",
    "editCover": "Editar Capa",
    "create": "Criar",
    "save": "Salvar",
    "selectItems": "Selecione as publicações que deseja adicionar.",
    "noContent": "Você não tem publicações para adicionar.",
    "memoryName": "Nome da Memória",
    "selectCover": "Escolha uma capa",
    "creating": "Criando...",
    "saving": "Salvando...",
    "error": "Ocorreu um erro. Tente novamente.",
    "addToMemoryTitle": "Salvar na Memória",
    "createNew": "Criar Nova Memória",
    "added": "Adicionado!",
    "uploadPhoto": "Enviar Foto"
  },
  "call": {
    "call": "Chamada",
    "calling": "Chamando {username}...",
    "incomingCall": "Chamada de {username}",
    "incomingVideoCall": "Vídeo chamada de {username}",
    "answer": "Atender",
    "decline": "Recusar",
    "hangUp": "Desligar",
    "callEnded": "Chamada encerrada",
    "onCallWith": "Em chamada com {username}",
    "shareScreen": "Compartilhar Tela",
    "stopShare": "Parar de Compartilhar",
    "videoCall": "Chamada de Vídeo",
    "voiceCall": "Chamada de Voz",
    "filters": {
        "none": "Normal",
        "bw": "P&B",
        "vintage": "Vintage",
        "soft": "Suave",
        "cool": "Frio",
        "focus": "Foco"
    }
  },
  "choiceModal": {
    "title": "O que você deseja criar?",
    "post": "Publicação",
    "pulse": "Pulse"
  },
  "vibeFeed": {
    "loading": "Carregando Vibes...",
    "noVibes": "Nenhum Vibe encontrado.",
    "comments": "Comentários",
    "share": "Compartilhar",
    "addComment": "Adicionar comentário...",
    "deleteTitle": "Excluir Vibe?",
    "deleteBody": "Tem certeza que deseja excluir este vídeo?",
    "sendTo": "Enviar para",
    "shareExternal": "Compartilhar via",
    "whatsapp": "WhatsApp / Status"
  },
  "welcome": {
    "title": "Bem-vindo ao Vibe"
  },
  "profile": {
    "editProfile": "Editar Perfil",
    "posts": "publicações",
    "followers": "seguidores",
    "followingCount": "seguindo",
    "message": "Mensagem",
    "logout": "Sair",
    "privateAccountMessage": "Esta conta é privada",
    "privateAccountSuggestion": "Siga para ver as fotos e vídeos.",
    "privateListsMessage": "Esta lista é privada.",
    "options": "Opções de perfil",
    "followersModalTitle": "Seguidores",
    "followingModalTitle": "Seguindo",
    "noFollowers": "Nenhum seguidor ainda.",
    "notFollowingAnyone": "Não segue ninguém ainda."
  },
  "editProfile": {
    "title": "Editar Perfil",
    "changePhoto": "Alterar foto do perfil",
    "usernameLabel": "Nome de usuário",
    "nicknameLabel": "Apelido",
    "bioLabel": "Bio",
    "vibeLabel": "Sua Vibe agora",
    "vibeJoy": "Feliz",
    "vibeAnger": "Focado",
    "vibeSloth": "Preguiça",
    "profileMusic": "Música do Perfil",
    "noProfileMusic": "Nenhuma música selecionada.",
    "changeMusic": "Trocar música",
    "removeMusic": "Remover",
    "privateAccount": "Conta Privada",
    "privateAccountInfo": "Apenas seus seguidores verão suas fotos.",
    "submit": "Salvar",
    "submitting": "Salvando...",
    "updateError": "Erro ao atualizar perfil.",
    "usernameCooldown": "Você só pode mudar o usuário a cada 30 dias.",
    "nicknameCooldown": "Você só pode mudar o apelido a cada 15 dias."
  }
};

const LanguageContext = createContext<any>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language] = useState('pt');

  const t = (key: string, replacements?: any): string => {
    let message = key.split('.').reduce((o: any, i) => (o ? o[i] : undefined), ptMessages) || key;
    if (replacements && typeof message === 'string') {
      Object.keys(replacements).forEach(placeholder => {
        message = message.replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }
    return message;
  };

  return (
    <LanguageContext.Provider value={{ language, t, loading: false }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
