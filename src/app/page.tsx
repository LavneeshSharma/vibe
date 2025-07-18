import React from 'react'
import { prisma } from '@/lib/db' // Adjust the import path as necessary
const page = async() => {
  const users = await prisma.user.findMany();
  return (
    <div>
     {JSON.stringify(users, null, 2)}
    </div>
  )
}

export default page