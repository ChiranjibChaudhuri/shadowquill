import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return new NextResponse('Missing email or password', { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email },
    });

    if (existingUser) {
      return new NextResponse('User already exists', { status: 409 }); // 409 Conflict
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12); // Salt rounds: 12

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        hashedPassword,
        name, // Include name if provided
      },
    });

    // Don't return the password hash
    // Destructure and explicitly mark hashedPassword as unused with '_'
    const { hashedPassword: _, ...userWithoutPassword } = user;

    return NextResponse.json(userWithoutPassword, { status: 201 }); // 201 Created
  } catch (error: unknown) { // Use unknown
    console.error('REGISTRATION ERROR:', error);
    // Optionally add type check for more specific error logging
    // const message = error instanceof Error ? error.message : String(error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
