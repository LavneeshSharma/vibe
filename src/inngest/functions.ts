import { inngest } from "./client";
import { openai, createAgent, createTool, createNetwork,type Tool,type Message,createState} from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompts";
import { prisma } from "@/lib/db";
interface AgentState{
  summary:string;
  files:{[path:string]:string};
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent " },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId= await step.run("get-sandbox-id", async () => {
       const sandbox = await Sandbox.create("vibe-nextjs-Lavneesh-2")
       return sandbox.sandboxId;
    });
    const previousMessages=await step.run("get-previous-messages", async () => {
      const formattedMessages:Message[]=[]
      const messages=await prisma.message.findMany({
        where:{
          projectId:event.data.projectId,
        },
        orderBy:{
          createdAt:"desc"
        }
      });
      for(const message of messages){
        formattedMessages.push({
          type:"text",
          role:message.role==="ASSISTANT"?"assistant":"user",
          content:`1 message: ${message.content}`,
        })
      }
      return formattedMessages;
    });
    const state=createState<AgentState>({
      summary:"",
      files:{}
    },
  {
    messages:previousMessages,
  })
    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description:"An expert coding-agent.",
      system: PROMPT,
      model: openai({
        model: "gpt-4.1",
        defaultParameters: {
          temperature: 0.1,
        }
      }),
      tools: [
        createTool({
          name:"terminal",
          description: "Run terminal commands in the sandbox",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command },{step}) => {
            return await step?.run("terminal",async()=>{
              const buffers={stdout:"",stderr:""};
              try{
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command,{
                  onStdout: (data:string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data:string) => {
                    buffers.stderr += data;
                  }
                });
                return result.stdout;
              }
              catch(e){
                console.error(`Error running command:${e} \n stdout: ${buffers.stdout} \n stderror: ${buffers.stderr}`);
                return `Error running command: ${e} \n stdout: ${buffers.stdout} \n stderror: ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name:"createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    })
  )
}),

        handler: async (
          { files }, 
          { step, network }:Tool.Options<AgentState>
        ) => {
           const newFiles=await step?.run("create-or-update-files", async () => {
           try{
           const sandbox = await getSandbox(sandboxId);
           const upDatedFiles = network.state.data.files || {};
           for (const file of files) {
            await sandbox.files.write(file.path, file.content);
            upDatedFiles[file.path] = file.content;
           }
           return upDatedFiles;
          }
          catch (e) {
            console.error(`Error creating or updating files: ${e}`);
            return {};
          }
        });
        if(typeof newFiles === "object"){
          network.state.data.files = newFiles;
        }
      },
    }),
      createTool({
        name:"readFiles",
        description: "Read files from the sandbox",
        parameters: z.object({
          files: z.array(z.string()),
        }), 
        handler: async ({ files }, { step, network }) => {
          return await step?.run("readFiles", async () => {
            try {
              const sandbox = await getSandbox(sandboxId);
              const contents = [];
              for (const file of files) {
                const content = await sandbox.files.read(file);
                contents.push({ path: file, content });
              }
              return JSON.stringify(contents);
            } catch (e) {
              return "Error:"+e;
            }
          });
        }
      }),
    ],
    lifecycle:{
      onResponse: async ({ result, network }) => {
          const lastAssistantMessageText=
           lastAssistantTextMessageContent(result)

           if(lastAssistantMessageText && network)
           {
              if(lastAssistantMessageText.includes("<task_summary>")){
                network.state.data.summary= lastAssistantMessageText;
              }
           }
           return result;
      }
    }
    });
    const network= createNetwork<AgentState>({
       name:"coding-agent-network",
       agents:[codeAgent],
       maxIter:15,
       defaultState:state,
       router:async({network})=>{
            const summary=network.state.data.summary;
            if(summary)
            {
               return;
            }
            return codeAgent;
       }
    })
    const result=await network.run(event.data.value,{state});
    const fragmentTitleGenerator=createAgent({
      name:"fragment-title-generator",
      description:"An expert title generator for code fragments",
      system:FRAGMENT_TITLE_PROMPT,
      model:openai({
        model:"gpt-4.1",
      })
    })
    const responseGenerator=createAgent({
      name:"response-generator",
      description:"An expert response generator for code fragments",
      system:RESPONSE_PROMPT,
      model:openai({
        model:"gpt-4.1",
      })
    })
   const parseAgentOutput=(value:Message[])=>{
      const output=value[0];
      if(output.type!=="text"){
        return "Fragment";
      }
     if(Array.isArray(output.content)){
      return output.content.map((txt)=>txt).join("");
     }
     else{
      return output;
     }
    }
    const generateFragmentTitle=()=>{
        if(fragmentTitleOutput[0].type!=="text")
        {
          return "Fragment";
        }
        if(Array.isArray(fragmentTitleOutput[0].content)){
          return fragmentTitleOutput[0].content.map((txt)=>txt).join("");
         }
         else{
          return fragmentTitleOutput[0].content;
         }
    }
    const generateResponse=()=>{
      if(responseOutput[0].type!=="text")
      {
        return "Here you go";
      }
      if(Array.isArray(responseOutput[0].content)){
        return responseOutput[0].content.map((txt)=>txt).join("");
       }
       else{
        return responseOutput[0].content;
       }
  }
    const {output:fragmentTitleOutput}=await fragmentTitleGenerator.run(result.state?.data?.summary);
    const {output:responseOutput}=await responseGenerator.run(result.state?.data?.summary);
    
   
    const isError=!result.state?.data?.summary || Object.keys(result.state?.data?.files || {}).length === 0;
    
    const sandboxUrl=await step.run("Get Sandbox URL", async () => {
      const sandboxUrl = await getSandbox(sandboxId);
      const host= sandboxUrl.getHost(3000);
      return `https://${host}`;
    });
    await step.run("save-result", async () => {
      if(isError){
        return await prisma.message.create({
          data:{
            projectId:event.data.projectId,
            content:"Please try again",
            role:"ASSISTANT",
            type:"ERROR",
          },
        });
      }
      return await prisma.message.create({
        data:{
          projectId:event.data.projectId,
          content:generateResponse() ,
          role:"ASSISTANT",
          type:"RESULT", 
          fragment:{
            create:{
              title:generateFragmentTitle() ,
              file:result.state?.data?.files || {},
              sandboxUrl:sandboxUrl,
            }
          }
        }
      })
    })
   return {
    url:sandboxUrl,
    title:generateFragmentTitle(),
    files:result.state?.data?.files || {},
    summary:result.state?.data?.summary || ""
  };
  },
);