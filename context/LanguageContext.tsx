
import React, { createContext, useContext, useState } from 'react';

const ptMessages = {
  "common": {
    "online": "Online",
    "cancel": "Cancelar",
    "delete": "Excluir",
    "deleting": "Excluindo...",
    "you": "Você",
    "user": "Usuário",
    "send": "Enviar"
  },
  "login": {
    "title": "Vibe",
    "emailLabel": "Endereço de e-mail",
    "passwordLabel": "Senha",
    "loginButton": "Entrar",
    "loggingInButton": "Entrando...",
    "forgotPassword": "Esqueceu a senha?",
    "noAccount": "Não tem uma conta?",
    "signUpLink": "Cadastre-se",
    "getTheApp": "Obtenha o aplicativo.",
    "error": "Falha ao entrar. Verifique seu e-mail e senha.",
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
    "haveAccount": "Tem uma conta?",
    "logInLink": "Entrar",
    "getTheApp": "Obtenha o aplicativo.",
    "emailInUseError": "Este e-mail já está em uso.",
    "genericError": "Falha ao criar uma conta. Por favor, tente novamente."
  },
  "header": {
    "title": "Vibe",
    "searchPlaceholder": "Pesquisar",
    "noResults": "Nenhum resultado encontrado.",
    "following": "Seguindo",
    "follow": "Seguir",
    "requested": "Solicitado",
    "notifications": "Notificações",
    "noActivity": "Nenhuma atividade nova.",
    "profile": "Perfil",
    "createPost": "Publicação",
    "createPulse": "Pulse (Story)",
    "createVibe": "Vibe (Reel)",
    "createStatus": "Música ou Texto",
    "vibes": "Vibes",
    "logOut": "Sair",
    "cancel": "Cancelar",
    "messages": "Direct",
    "home": "Página Inicial",
    "create": "Criar",
    "accept": "Aceitar",
    "decline": "Recusar",
    "followNotification": "{username} começou a seguir você.",
    "messageNotification": "{username} te enviou uma mensagem.",
    "followRequestNotification": "{username} quer seguir você.",
    "mentionCommentNotification": "{username} mencionou você: \"{commentText}\"",
    "duoRequestNotification": "<b>{username}</b> te convidou para um Duo.",
    "tagRequestNotification": "<b>{username}</b> te marcou numa publicação."
  },
  "post": {
    "like": "Curtir",
    "comment": "Comentar",
    "republish": "Republicar",
    "youRepublicated": "Você republicou",
    "republishedBy": "Republicado por {username}",
    "forward": "Encaminhar",
    "likes": "curtidas",
    "viewAllComments": "Ver todos os {count} comentários",
    "addComment": "Comentar...",
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
    "addToMemory": "Salvar na Memória"
  },
  "createStatus": {
    "title": "Nova Publicação",
    "placeholder": "No que você está pensando?",
    "share": "Compartilhar",
    "sharing": "Compartilhando...",
    "background": "Fundo",
    "font": "Fonte"
  },
  "musicSearch": {
    "fetchError": "Erro ao buscar músicas",
    "searchError": "Ocorreu um erro durante a busca.",
    "trimInstructions": "Deslize para escolher os 25s da música",
    "done": "Concluir"
  },
  "addMusicModal": {
    "title": "Música"
  },
  "welcome": {
    "title": "Bem-vindo(a) ao Vibe"
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
