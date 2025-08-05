import {RateLimiterPrisma} from "rate-limiter-flexible"
import { prisma } from "./db"
import { auth } from "@clerk/nextjs/server";
const GENERATION_COST=1;
const FREE_CREDITS=5;
const FREE_DURATION=30*60*24*60;
const PRO_CREDITS=1000;
export async function getUsageTracker(){
    const {has}=await auth();
    const hasProAccess=has({plan:"pro"})
    if(!has){
        throw new Error("User not authenticated")
    }
    const usageTracker=new RateLimiterPrisma({
        storeClient:prisma,
        tableName:"Usage",
        points:hasProAccess?PRO_CREDITS:FREE_CREDITS,
        duration:FREE_DURATION
    })
    return usageTracker;
}
export async function consumeCredits(){
    const {userId}=await auth();
    if(!userId){
        throw new Error("User not authenticated")
    }
    const usageTracker=await getUsageTracker();
    const result=await usageTracker.consume(userId,GENERATION_COST);
    return result;
}
export async function getUsageStatus(){
     const {userId}=await auth();
     if(!userId){
        throw new Error("User not authenticated")
     }
     const usageTracker=await getUsageTracker();
     const result=await usageTracker.get(userId);
     return result;
}