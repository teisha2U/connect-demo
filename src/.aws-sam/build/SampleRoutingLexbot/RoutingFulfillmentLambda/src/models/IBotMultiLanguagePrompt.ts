// this interface is similar to the prompt 
// data structure in  the admin app
export interface IBotMultiLanguagePrompt {
    BotName: string;
    PromptName: string;
    data: ITranslations[];
    type: string;
    disabled: "true" | "false";
}

export interface ITranslations {
    language: string;
    text: string;
}