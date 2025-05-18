import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CommonLayout } from './common-layout';

export function ThemeTest() {
  return (
    <CommonLayout pageTitle="Theme Test">
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Twitch Theme Test</CardTitle>
            <CardDescription>This card tests all UI components with the Twitch theme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-6">
              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: '#FFFFFF' }}>Twitch Color Palette</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-md overflow-hidden border border-[#26262c]">
                    <div className="h-20" style={{ backgroundColor: '#0e0e10' }}></div>
                    <div className="p-2 text-xs font-mono" style={{ backgroundColor: '#18181b' }}>
                      <div className="text-white">#0e0e10</div>
                      <div className="text-gray-400">Primary Background</div>
                    </div>
                  </div>
                  <div className="rounded-md overflow-hidden border border-[#26262c]">
                    <div className="h-20" style={{ backgroundColor: '#18181b' }}></div>
                    <div className="p-2 text-xs font-mono" style={{ backgroundColor: '#26262c' }}>
                      <div className="text-white">#18181b</div>
                      <div className="text-gray-400">Secondary Background</div>
                    </div>
                  </div>
                  <div className="rounded-md overflow-hidden border border-[#26262c]">
                    <div className="h-20" style={{ backgroundColor: '#9146FF' }}></div>
                    <div className="p-2 text-xs font-mono" style={{ backgroundColor: '#18181b' }}>
                      <div className="text-white">#9146FF</div>
                      <div className="text-gray-400">Twitch Purple</div>
                    </div>
                  </div>
                  <div className="rounded-md overflow-hidden border border-[#26262c]">
                    <div className="h-20" style={{ backgroundColor: '#26262c' }}></div>
                    <div className="p-2 text-xs font-mono" style={{ backgroundColor: '#18181b' }}>
                      <div className="text-white">#26262c</div>
                      <div className="text-gray-400">Border Color</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: '#FFFFFF' }}>Buttons</h3>
                <div className="grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="default">Primary Button</Button>
                    <Button variant="secondary">Secondary Button</Button>
                    <Button variant="outline">Outline Button</Button>
                    <Button variant="ghost">Ghost Button</Button>
                    <Button variant="link">Link Button</Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button variant="default" size="sm">Small Button</Button>
                    <Button variant="default">Default Size</Button>
                    <Button variant="default" size="lg">Large Button</Button>
                  </div>
                  
                  <div className="p-4 rounded-md" style={{ backgroundColor: 'rgba(20, 20, 20, 0.95)' }}>
                    <h4 className="mb-2 text-sm font-medium" style={{ color: '#FFFFFF' }}>Buttons in context (Twitch-like UI)</h4>
                    <div className="flex items-center gap-2">
                      <Button variant="default" size="sm">Subscribe</Button>
                      <Button variant="secondary" size="sm">Follow</Button>
                      <Button variant="outline" size="sm">Share</Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: '#FFFFFF' }}>Form Controls</h3>
                <div className="grid gap-4 max-w-md">
                  <Input placeholder="Input field" />
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: '#FFFFFF' }}>Text Styles</h3>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold" style={{ color: '#FFFFFF' }}>Heading 1</h1>
                  <h2 className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>Heading 2</h2>
                  <h3 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>Heading 3</h3>
                  <p className="text-base" style={{ color: '#EFEFF1' }}>Regular paragraph text</p>
                  <p className="text-sm" style={{ color: '#ADADB8' }}>Secondary text in gray</p>
                  <a href="#" style={{ color: '#9146FF' }}>Twitch purple link</a>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: '#FFFFFF' }}>Table Example</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border" style={{ backgroundColor: '#0e0e10', borderColor: '#26262c' }}>
                    <thead>
                      <tr>
                        <th className="p-2 text-left" style={{ backgroundColor: '#18181b', borderColor: '#26262c', color: '#FFFFFF' }}>Name</th>
                        <th className="p-2 text-left" style={{ backgroundColor: '#18181b', borderColor: '#26262c', color: '#FFFFFF' }}>Value</th>
                        <th className="p-2 text-left" style={{ backgroundColor: '#18181b', borderColor: '#26262c', color: '#FFFFFF' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border-t" style={{ borderColor: '#26262c', color: '#EFEFF1' }}>Item 1</td>
                        <td className="p-2 border-t" style={{ borderColor: '#26262c', color: '#EFEFF1' }}>100</td>
                        <td className="p-2 border-t" style={{ borderColor: '#26262c' }}><a href="#" style={{ color: '#9146FF' }}>View</a></td>
                      </tr>
                      <tr>
                        <td className="p-2 border-t" style={{ borderColor: '#26262c', color: '#EFEFF1' }}>Item 2</td>
                        <td className="p-2 border-t" style={{ borderColor: '#26262c', color: '#EFEFF1' }}>200</td>
                        <td className="p-2 border-t" style={{ borderColor: '#26262c' }}><a href="#" style={{ color: '#9146FF' }}>View</a></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-sm" style={{ color: '#ADADB8' }}>All styling should match the Twitch theme exactly</p>
          </CardFooter>
        </Card>
      </div>
    </CommonLayout>
  );
} 