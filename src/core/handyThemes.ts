import type { HandyActionsLiveActivityProps, HandyState } from './handyModel.ts';

export type ThemeId = NonNullable<HandyState['theme']>;
export const themeOptions: {id:ThemeId;name:string;description:string;colors:string[]}[] = [
  {id:'psychedelic',name:'Psychedelic',description:'Violet, electric blue, and magenta. Palette changes on explicit refresh.',colors:['#381265','#113E69','#72234C']},
  {id:'midnight',name:'Midnight',description:'Quiet charcoal and teal.',colors:['#0E1820','#15333D','#14212D']},
  {id:'paper',name:'Paper',description:'Soft ivory with dark, high-contrast labels.',colors:['#F4F0E5','#E4EEE9','#F3E9DD']},
];
export function activityTheme(id:ThemeId='psychedelic', updatedAt = ''): NonNullable<HandyActionsLiveActivityProps['theme']> {
  const option=themeOptions.find(t=>t.id===id) ?? themeOptions[0];
  const phase=id==='psychedelic' && updatedAt ? Math.abs(Math.floor(Date.parse(updatedAt)/1000)||0)%option.colors.length:0;
  const colors=[...option.colors.slice(phase),...option.colors.slice(0,phase)];
  return {id:option.id,colors,accent:id==='paper'?'#176D61':'#A7F3D0',ink:id==='paper'?'#172D36':'#F8FAFC',muted:id==='paper'?'#475569':'#D3DFEB',tile:id==='paper'?'#FFFFFF':'#152238'};
}
