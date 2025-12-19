
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
    "searchPlaceholder": "Pesquisar",
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
    "followNotification": "{username} começou a seguir você.",
    "messageNotification": "{username} enviou uma mensagem.",
    "followRequestNotification": "{username} quer seguir você.",
    "mentionCommentNotification": "{username} mencionou você: \"{commentText}\"",
    "duoRequestNotification": "<b>{username}</b> te convidou para um Duo.",
    "tagRequestNotification": "<b>{username}</b> te marcou numa publicação."
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
    "deletePostTitle": "Excluir publicação?",
    "deletePostBody": "Tem certeza? Esta ação não pode ser desfeita.",
    "youRepublicated": "Você republicou",
    "republishedBy": "Republicado por {username}",
    "addToMemory": "Salvar na Memória"
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
  },
  "createPost": {
    "title": "Nova Publicação",
    "share": "Compartilhar",
    "sharing": "Compartilhando...",
    "captionLabel": "Escreva uma legenda...",
    "publishError": "Erro ao publicar.",
    "addMusic": "Adicionar Música",
    "changeMusic": "Trocar Música",
    "searchMusicPlaceholder": "Buscar música ou artista...",
    "musicNoResults": "Nenhuma música encontrada.",
    "selectFromComputer": "Selecionar do dispositivo"
  },
  "createPulse": {
    "title": "Criar Pulse",
    "location": "Localização",
    "locationPlaceholder": "Pesquisar local...",
    "searchingLocations": "Buscando locais...",
    "poll": "Enquete",
    "pollQuestion": "Faça uma pergunta...",
    "pollOption1": "Sim",
    "pollOption2": "Não",
    "countdown": "Contagem Regressiva",
    "countdownTitle": "Dê um nome...",
    "days": "Dias",
    "hours": "Horas",
    "mins": "Min"
  },
  "createStatus": {
    "placeholder": "No que você está pensando?",
    "background": "Fundo",
    "font": "Fonte",
    "share": "Compartilhar",
    "sharing": "Publicando..."
  },
  "messages": {
    "title": "Mensagens",
    "newMessage": "Nova mensagem",
    "newMessageTitle": "Nova Mensagem",
    "close": "Fechar",
    "loading": "Carregando...",
    "noConversations": "Nenhuma conversa ainda.",
    "back": "Voltar",
    "yourMessages": "Suas Mensagens",
    "sendPrivate": "Envie fotos e mensagens privadas para um amigo.",
    "messagePlaceholder": "Mensagem...",
    "send": "Enviar",
    "seen": "Visualizada",
    "typing": "Digitando...",
    "recordingAudio": "Gravando áudio...",
    "anonymousModeOn": "Modo Anônimo ativado",
    "anonymousModeOff": "Modo Online ativado",
    "deleteTitle": "Excluir Mensagem?",
    "deleteBody": "Isso não poderá ser desfeito.",
    "deleteConversationTitle": "Excluir Conversa?",
    "deleteConversationBody": "A conversa será apagada para ambos.",
    "deleteConversationConfirm": "Excluir",
    "searchUsers": "Pesquisar pessoas...",
    "diariesTitle": "Notas",
    "addNote": "Sua Nota",
    "replyToNote": "Responder nota de {username}...",
    "media": {
        "photo": "Foto",
        "video": "Vídeo",
        "audio": "Áudio",
        "select": "Anexar mídia",
        "uploadError": "Erro no envio.",
        "videoTooLong": "Vídeo deve ter menos de 30s.",
        "cancelUpload": "Cancelar",
        "viewMedia": "Ver mídia"
    },
    "forwardedPost": "Encaminhou uma publicação"
  },
  "pulseViewer": {
    "replyPlaceholder": "Enviar mensagem...",
    "viewedBy": "Visto por",
    "noViews": "Nenhuma visualização.",
    "delete": "Excluir",
    "deleteTitle": "Excluir Pulse?",
    "deleteBody": "Esta ação é permanente."
  },
  "vibeFeed": {
    "loading": "Sintonizando Vibes...",
    "noVibes": "Nenhum Vibe postado ainda."
  },
  "welcome": {
    "title": "Bem-vindo ao Vibe"
  },
  "time": {
    "seconds": "há {count}s",
    "minutes": "há {count}m",
    "hours": "há {count}h",
    "days": "há {count}d"
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
