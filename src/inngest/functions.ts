import { inngest } from "./client";
import { openai, createAgent, createTool, createNetwork, Tool} from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { PROMPT } from "@/prompts";
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
       router:async({network})=>{
            const summary=network.state.data.summary;
            if(summary)
            {
               return;
            }
            return codeAgent;
       }
    })
    const result=await network.run(event.data.value);
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
            content:"Please try again",
            role:"ASSISTANT",
            type:"ERROR",
          }
        })
      }
      const message=await prisma.message.create({
        data:{
          content:result.state?.data?.summary || "",
          role:"ASSISTANT",
          type:"RESULT", 
          fragment:{
            create:{
              title:"Fragment",
              file:result.state?.data?.files || {},
              sandboxUrl:sandboxUrl,
            }
          }
        }
      })
    })
   return {
    url:sandboxUrl,
    title:"Fragment",
    files:result.state?.data?.files || {},
    summary:result.state?.data?.summary || ""
  };
  },
);