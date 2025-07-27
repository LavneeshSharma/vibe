import { PrismaClient, Prisma } from "../src/generated/prisma";

const prisma = new PrismaClient();
export async function main() {
  // Add seeding logic for Message or Fragment here if needed
}
// const userData: Prisma.UserCreateInput[] = [
//   {
//     name: "Alice",
//     email: "alice@prisma.io",
   
//   },
//   {
//     name: "Bob",
//     email: "bob@prisma.io",
   
//   },
// ];

// export async function main() {
//   for (const u of userData) {
//     await prisma.user.create({ data: u });
//   }
// }

main();