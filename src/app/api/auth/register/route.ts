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
    // Use type assertion to bypass TS error if it persists
    const { hashedPassword: _, ...userWithoutPassword } = (user as any);

    return NextResponse.json(userWithoutPassword, { status: 201 }); // 201 Created
  } catch (error: any) {
    console.error('REGISTRATION ERROR:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
