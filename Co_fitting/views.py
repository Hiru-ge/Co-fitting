from django.shortcuts import render
from django.http import HttpResponse

def index(request):
    return render(request, 'Co-fitting/index.html')

def how_to_use(request):
    return render(request, 'Co-fitting/how-to-use.html')

def introduce_preset(request):
    return render(request, 'Co-fitting/introduce-preset.html')

def coffee_theory(request):
    return render(request, 'Co-fitting/coffee-theory.html')

def login(request):
    return render(request, 'Co-fitting/login.html')

def loginAuthorize(request):
    username = request.POST['username']
    password = request.POST['password']
    params = {
        'username': username,
        'password': password
    }
    # todo: DB内の情報と照合してログイン許可する処理を追加
    
    return render(request, 'Co-fitting/mypage.html', params)
    
def mypage(request):
    return render(request, 'Co-fitting/mypage.html')

def preset_create(request):
    return render(request, 'Co-fitting/preset-create.html')