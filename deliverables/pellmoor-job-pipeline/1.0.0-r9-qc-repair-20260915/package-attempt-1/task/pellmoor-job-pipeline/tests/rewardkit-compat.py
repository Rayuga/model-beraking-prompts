from importlib.metadata import version
from pathlib import Path
import sysconfig

original = '''        total_w = sum(r.reward_weight for r in rlist)
        if total_w == 0:
            flat[rname] = 0.0
        else:
'''
replacement = '''        total_w = sum(r.reward_weight for r in rlist)
        if len(rlist) == 1:
            flat[rname] = round(rlist[0].score, 4)
        elif total_w == 0:
            flat[rname] = 0.0
        else:
'''

def apply():
    if version('harbor-rewardkit') != '0.1.7':
        raise RuntimeError('Review the zero-weight dimension compatibility fix for this RewardKit version')
    path = Path(sysconfig.get_paths()['purelib']) / 'rewardkit' / 'runner.py'
    source = path.read_text(encoding='utf-8')
    if source.count(replacement) == 1 and original not in source:
        print('RewardKit single-judge dimension compatibility fix already applied')
    elif source.count(original) == 1 and replacement not in source:
        source = source.replace(original, replacement, 1)
        compile(source, str(path), 'exec')
        path.write_text(source, encoding='utf-8')
        print('Preserved single-judge dimension scores independently of reward weights')
    else:
        raise RuntimeError('Unexpected RewardKit dimension aggregation source; refusing an unverified edit')


if __name__ == '__main__':
    apply()
