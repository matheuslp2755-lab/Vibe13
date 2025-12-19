
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
    "error": "Ocorreu um erro. Tente novamente.",
    "back": "Voltar",
    "next": "Próximo",
    "done": "Concluir",
    "loading": "Carregando..."
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
    "browser": "Explorar Web",
    "followNotification": "{username} começou a seguir você.",
    "messageNotification": "{username} enviou uma mensagem.",
    "followRequestNotification": "{username} quer seguir você.",
    "mentionCommentNotification": "{username} mencionou você: \"{commentText}\"",
    "duoRequestNotification": "<b>{username}</b> te convidou para um Duo.",
    "tagRequestNotification": "<b>{username}</b> te marcou numa publicação.",
    "duoAcceptedNotification": "<b>{username}</b> aceitou seu convite de Duo.",
    "tagAcceptedNotification": "<b>{username}</b> aceitou sua marcação."
  },
  "createPost": {
    "title": "Criar Publicação",
    "share": "Compartilhar",
    "captionLabel": "Escreva uma legenda...",
    "addMusic": "Adicionar música"
  },
  "createPulse": {
    "title": "Novo Pulse",
    "effects": "Efeitos",
    "filters": "Filtros",
    "lenses": "Lentes",
    "takePhoto": "Tirar Foto",
    "gallery": "Galeria",
    "effectNone": "Nenhum",
    "effectBloom": "Suave",
    "effectNoir": "Cinema Noir",
    "effectCyber": "Cyberpunk",
    "effectRetro": "Vintage",
    "effectAura": "Aura Mística"
  },
  "diary": {
    "title": "Notas",
    "publish": "Publicar",
    "publishing": "Publicando...",
    "placeholder": "No que você está pensando hoje?",
    "empty": "O diário está vazio.",
    "emptySuggestion": "Siga pessoas para ver as notas delas aqui ou escreva a sua!",
    "alreadyPosted": "Você já postou sua nota de hoje. Volte amanhã!"
  },
  "musicSearch": {
    "fetchError": "Erro ao buscar músicas",
    "searchError": "Ocorreu um erro durante a busca.",
    "trimInstructions": "Deslize para escolher os 25s perfeitos",
    "done": "Concluir",
    "suggestions": "Sugestões para você",
    "trending": "Bombando no Vibe",
    "lyricsTitle": "Letras sincronizadas"
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
    "changeMusic": "Trocar trilha sonora",
    "addMusic": "Adicionar trilha sonora",
    "tagFriends": "Marcar amigos",
    "inviteDuo": "Convidar Duo",
    "duoPending": "Duo Pendente",
    "duoPartner": "Com {username}",
    "deletePostTitle": "Excluir publicação?",
    "deletePostBody": "Tem certeza? Esta ação não pode ser desfeita.",
    "youRepublicated": "Você republicou",
    "republishedBy": "Republicado por {username}",
    "addToMemory": "Salvar na Memória",
    "anonymousComment": "Anônimo",
    "anonymousCommentTaken": "Esta publicação já possui o limite de 1 comentário anônimo.",
    "vibeAnon": "Vibe Anon"
  },
  "gallery": {
    "title": "Nova Publicação",
    "selectPhotos": "Selecionar Fotos",
    "next": "Avançar",
    "galleryTab": "Galeria",
    "cameraTab": "Câmera",
    "capture": "Capturar",
    "cameraError": "Não foi possível acessar a câmera."
  },
  "aiGenerator": {
    "title": "Criador IA Vibe",
    "promptLabel": "O que você quer criar?",
    "promptPlaceholder": "Descreva a imagem que deseja gerar...",
    "generate": "Gerar com IA",
    "generating": "Inspirando a IA...",
    "useImage": "Usar esta Foto",
    "error": "Erro ao gerar imagem. Tente novamente."
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
  "forwardModal": {
    "title": "Encaminhar para",
    "search": "Pesquisar amigos...",
    "noFollowing": "Você não segue ninguém ainda.",
    "noResults": "Nenhum usuário encontrado.",
    "send": "Enviar",
    "sending": "Enviando...",
    "sent": "Enviado"
  },
  "pulseViewer": {
    "previous": "Anterior",
    "next": "Próximo",
    "delete": "Excluir Pulse",
    "deleteTitle": "Excluir Pulse?",
    "deleteBody": "Tem certeza que deseja excluir?",
    "save": "Salvar",
    "replyPlaceholder": "Enviar mensagem..."
  },
  "vibeFeed": {
    "loading": "Carregando Vibes...",
    "noVibes": "Nenhum Vibe encontrado.",
    "comments": "Comentários",
    "share": "Compartilhar",
    "addComment": "Comentar...",
    "deleteTitle": "Excluir Vibe?",
    "deleteBody": "Tem certeza que deseja excluir?",
    "sendTo": "Enviar para",
    "shareExternal": "Compartilhar via",
    "whatsapp": "WhatsApp / Status"
  },
  "browser": {
    "title": "Vibe Explorer",
    "placeholder": "Pesquise na internet...",
    "searching": "Buscando no Google...",
    "empty": "O que você quer descobrir hoje?",
    "sources": "Fontes:"
  },
  "messages": {
    "title": "Mensagens",
    "newMessage": "Nova mensagem",
    "close": "Fechar",
    "loading": "Carregando conversas...",
    "noConversations": "Nenhuma conversa ainda.",
    "back": "Voltar",
    "messagePlaceholder": "Mensagem...",
    "diariesTitle": "Notas",
    "addNote": "Sua Nota",
    "replyToNote": "Responder a {username}...",
    "anonymousModeOn": "Modo Anônimo Ativado",
    "anonymousModeOff": "Modo Anônimo Desativado"
  },
  "memories": {
    "new": "Nova",
    "add": "Adicionar",
    "title": "Memórias",
    "edit": "Editar Memória",
    "delete": "Excluir Memória",
    "deleteConfirm": "Deseja excluir esta memória?",
    "selectContent": "Selecionar Conteúdo",
    "next": "Próximo",
    "name": "Nome",
    "editCover": "Editar Capa",
    "create": "Criar",
    "save": "Salvar",
    "memoryName": "Nome da Memória",
    "selectCover": "Escolha uma capa",
    "creating": "Criando...",
    "added": "Adicionado!",
    "addToMemoryTitle": "Salvar na Memória",
    "createNew": "Criar Nova"
  },
  "call": {
    "call": "Chamada",
    "calling": "Chamando {username}...",
    "incomingCall": "Chamada de {username}",
    "answer": "Atender",
    "decline": "Recusar",
    "hangUp": "Desligar",
    "callEnded": "Chamada encerrada",
    "onCallWith": "Em chamada com {username}",
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
  "editProfile": {
    "title": "Editar Perfil",
    "changePhoto": "Alterar foto",
    "usernameLabel": "Nome de usuário",
    "nicknameLabel": "Apelido",
    "bioLabel": "Bio",
    "vibeLabel": "Sua Vibe agora",
    "vibeJoy": "Feliz",
    "vibeAnger": "Focado",
    "vibeSloth": "Preguiça",
    "profileMusic": "Música do Perfil",
    "noProfileMusic": "Nenhuma selecionada.",
    "changeMusic": "Trocar música",
    "removeMusic": "Remover",
    "privateAccount": "Conta Privada",
    "privateAccountInfo": "Apenas seguidores verão suas fotos.",
    "submit": "Salvar",
    "submitting": "Salvando...",
    "updateError": "Erro ao atualizar perfil.",
    "usernameCooldown": "Mude o usuário a cada 30 dias.",
    "nicknameCooldown": "Mude o apelido a cada 15 dias."
  },
  "welcome": {
    "title": "Bem-vindo ao Vibe"
  },
  "createStatus": {
    "title": "Nova Publicação",
    "placeholder": "No que você está pensando?",
    "share": "Compartilhar",
    "sharing": "Compartilhando...",
    "background": "Fundo",
    "font": "Fonte"
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
