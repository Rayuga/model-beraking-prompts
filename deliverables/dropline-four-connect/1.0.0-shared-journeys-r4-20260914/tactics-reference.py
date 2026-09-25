import json
from pathlib import Path

LINES = []
for r in range(6):
    for c in range(7):
        for dr,dc in [(0,1),(1,0),(1,1),(1,-1)]:
            cells=[(r+i*dr,c+i*dc) for i in range(4)]
            if all(0<=a<6 and 0<=b<7 for a,b in cells): LINES.append(cells)

def evaluate(board, player, depth):
    winner=next((board[a[0]][a[1]] for line in LINES if (a:=line[0]) and board[a[0]][a[1]] and all(board[r][c]==board[a[0]][a[1]] for r,c in line)),0)
    if winner:return ('win' if winner==player else 'loss',0)
    legal=[c for c in range(7) if not board[5][c]]
    if not legal:return ('draw',0)
    if depth==0:return ('unknown',None)
    values=[]
    for c in legal:
        r=next(r for r in range(6) if not board[r][c]);board[r][c]=player
        result,distance=evaluate(board,3-player,depth-1);board[r][c]=0
        values.append(({'win':'loss','loss':'win'}.get(result,result),None if distance is None else distance+1))
    wins=[d for v,d in values if v=='win']
    if wins:return ('win',min(wins))
    if all(v=='loss' for v,d in values):return ('loss',max(d for v,d in values))
    if all(v!='unknown' for v,d in values):return ('draw',None)
    return ('unknown',None)

draw=[4,4,4,4,4,4,3,3,3,3,3,3,5,2,5,6,5,5,5,5,2,2,2,2,2,6,1,6,6,6,6,1,1,1,1,1,7,7,7,7,7,7]
cases=[('empty',[],4),('immediate',[1,7,2,7,3,6],1),('fork-shallow',[2,7,3,7],1),('fork-deep',[2,7,3,7],3),('forced-loss',[2,7,3,7,4],2),('block',[7,1,7,2,6,3],2),('full-column',[1,1,1,1,1,1],2),('draw-last',draw[:-1],1),('terminal-win',[1,7,2,7,3,6,4],4),('terminal-draw',draw,4)]
results=[]
cases.extend([('shortest-win',[1,7,2,7,3,6],3),('best-resistance',[7,3,3,7,2,2,6,3,6,6,3,3,4,1,7],4)])
for name,moves,depth in cases:
    board=[[0]*7 for _ in range(6)]
    for i,col in enumerate(moves):
        c=col-1;r=next(r for r in range(6) if not board[r][c]);board[r][c]=i%2+1
    player=len(moves)%2+1
    result,distance=evaluate(board,player,depth)
    terminal=evaluate(board,player,0)[0]!='unknown'
    columns=[]
    if not terminal:
        for c in range(7):
            if board[5][c]:continue
            r=next(r for r in range(6) if not board[r][c]);board[r][c]=player
            v,d=evaluate(board,3-player,depth-1);board[r][c]=0
            columns.append(dict(column=c+1,outcome={'win':'loss','loss':'win'}.get(v,v),distance=None if d is None else d+1))
    results.append(dict(name=name,moves=moves,depth=depth,outcome=result,distance=distance,terminal=terminal,columns=columns))
Path(__file__).with_name('tactical-fixtures.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
