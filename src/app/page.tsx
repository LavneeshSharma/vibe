import React, { Suspense } from 'react'
import { prisma } from '@/lib/db' // Adjust the import path as necessary
import { useTRPC } from '@/trpc/client'
import { text } from 'stream/consumers';
import { trpc, getQueryClient } from '@/trpc/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Client } from './client';
const page = async() => {
  const queryclient=getQueryClient();
  void queryclient.prefetchQuery(trpc.createai.queryOptions({ text: 'Hello' }));
  return (
    <HydrationBoundary state={dehydrate(queryclient)}>
      <Suspense fallback={<div>Loading...</div>}>
        <Client />
      </Suspense>
    </HydrationBoundary>
  )
}

export default page